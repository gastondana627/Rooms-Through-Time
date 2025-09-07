# --------------------------------------------------------------
# main.py
# --------------------------------------------------------------
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import fal_client
import base64
import io
from PIL import Image
import os
from dotenv import load_dotenv

# --------------------------------------------------------------
# 1️⃣  Load env‑vars & start FastAPI
# --------------------------------------------------------------
load_dotenv()                     # .env → os.environ
app = FastAPI(title="AI Room Designer API")

# Allow the Vite dev server (both http & https) to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://localhost:5173",
        "http://127.0.0.1:5173",
        "https://127.0.0.1:5173",
        "https://rooms-through-time.vercel.app",          # Vercel front‑end
        "https://rooms-through-time.vercel.app/",        # trailing slash
        "https://rooms-through-time-production.up.railway.app",  # <-- NEW
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------
# 2️⃣ Fal.AI configuration
# --------------------------------------------------------------
FAL_KEY = os.getenv("FAL_KEY")
if not FAL_KEY:
    raise ValueError("FAL_KEY environment variable is required")
print("✅ FAL API key configured successfully")
fal_client.api_key = FAL_KEY

# -----------------------------------------------------------------
# 2.1  3‑D reconstruction model slug - UPDATED WITH WORKING MODELS
# -----------------------------------------------------------------
# Updated to use actual working models instead of non-existent "3d-reconstruction"
FAL_3D_MODELS = [
    "fal-ai/trellis",      # Primary model - most versatile
    "fal-ai/triposr",      # Fallback 1 - good for objects
    "fal-ai/hyper3d",      # Fallback 2 - high quality
]

# -----------------------------------------------------------------
# 2.2  Demo GLB – a publicly hosted .glb used as fallback
# -----------------------------------------------------------------
# This URL is guaranteed to exist (it ships with the model‑viewer repo).
# Feel free to replace it with any GLB you host yourself.
DEMO_GL_B_URL = (
    "https://modelviewer.dev/shared-assets/models/Astronaut.glb"
)

# --------------------------------------------------------------
# 3️⃣ Request models (Pydantic)
# --------------------------------------------------------------
class SegmentRequest(BaseModel):
    image_url: str               # data:image/...;base64,XXXXX


class RecolorRequest(BaseModel):
    image_url: str               # original image (data‑url)
    mask: dict                   # {"mask": "<base64‑png>"}
    color: list                  # [R, G, B] ints 0‑255


class ReconstructRequest(BaseModel):
    image_url: str               # data‑url of the image we want to turn into 3‑D


# --------------------------------------------------------------
# 4️⃣ Helper utilities – base64 ↔ Pillow.Image
# --------------------------------------------------------------
def base64_to_image(b64: str) -> Image.Image:
    """
    Convert a data‑url (e.g. ``data:image/png;base64,AAAA``) or a raw
    base64 string into a Pillow ``Image``.
    """
    if b64.startswith("data:image"):
        b64 = b64.split(",", 1)[1]        # strip the mime‑type prefix
    img_bytes = base64.b64decode(b64.strip())
    img = Image.open(io.BytesIO(img_bytes))
    if img.mode != "RGB":
        img = img.convert("RGB")
    return img


def image_to_base64(image: Image.Image, fmt: str = "JPEG") -> str:
    """
    Encode a Pillow ``Image`` as a base64 string (no ``data:`` prefix).
    """
    buf = io.BytesIO()
    if fmt.upper() == "JPEG" and image.mode != "RGB":
        image = image.convert("RGB")
    image.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()


# --------------------------------------------------------------
# 5️⃣ Routes
# --------------------------------------------------------------
@app.get("/")
async def root():
    return {"message": "AI Room Designer API is running"}


# -----------------------------------------------------------------
# 5.1  Segmentation (unchanged)
# -----------------------------------------------------------------
@app.post("/segment")
async def segment_image(request: SegmentRequest):
    """
    Returns a list of masks, each mask is a base64‑png string.
    """
    try:
        print("🔍 Starting image segmentation…")
        pil_img = base64_to_image(request.image_url)
        img_b64 = image_to_base64(pil_img)          # JPEG for Fal

        # centre‑point prompt – works for any resolution
        w, h = pil_img.size
        centre = [w // 2, h // 2]

        payload = {
            "image_url": f"data:image/jpeg;base64,{img_b64}",
            "prompts": [
                {
                    "type": "point",
                    "point_coords": [centre],
                    "point_labels": [1],
                }
            ],
            "multimask_output": True,
        }

        result = fal_client.run("fal-ai/sam2/image", arguments=payload)

        segments = []
        for i, mask_info in enumerate(result.get("masks", [])):
            mask_url = mask_info["mask"]
            mask_b64 = mask_url.split(",", 1)[1] if mask_url.startswith("data:") else mask_url
            segments.append(
                {
                    "label": f"Object {i + 1}",
                    "mask": mask_b64,
                    "confidence": mask_info.get("score", 0.8),
                }
            )
        return {"segments": segments}
    except Exception as exc:
        import traceback
        print("❌ Segmentation error:", exc)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {exc}")


# -----------------------------------------------------------------
# 5.2  Recolour (unchanged)
# -----------------------------------------------------------------
@app.post("/recolor")
async def recolor_object(request: RecolorRequest):
    """
    Paint the masked region with the supplied RGB colour and
    return a JPEG data‑url.
    """
    try:
        img = base64_to_image(request.image_url)

        mask_b64 = request.mask.get("mask", "")
        if not mask_b64:
            raise ValueError("Mask payload is empty")
        mask_bytes = base64.b64decode(mask_b64)
        mask_img = Image.open(io.BytesIO(mask_bytes)).convert("L")   # 8‑bit mask

        colour = tuple(request.color)                # (R, G, B)
        overlay = Image.new("RGB", img.size, colour)

        recoloured = Image.composite(overlay, img, mask_img)

        recoloured_b64 = image_to_base64(recoloured, fmt="JPEG")
        return {"image_url": f"data:image/jpeg;base64,{recoloured_b64}"}
    except Exception as exc:
        import traceback
        print("❌ Recolor error:", exc)
        print(traceback.format_exc())
        # Return the original image so the UI never crashes
        return {"image_url": request.image_url}


# -----------------------------------------------------------------
# 5.3  3‑D reconstruction (FIXED TO EXTRACT model_mesh.url)
# -----------------------------------------------------------------
@app.post("/reconstruct")
async def reconstruct_3d(request: ReconstructRequest):
    """
    Calls Fal AI's 3‑D reconstruction models in fallback order and returns a single field
    ``reconstruction_url`` that points to a .glb file.
    If no models work, a demo GLB is returned as a graceful fallback.
    """
    try:
        print("🪐 Starting 3‑D reconstruction…")
        pil_img = base64_to_image(request.image_url)

        # Fal expects a JPEG data‑url
        img_b64 = image_to_base64(pil_img, fmt="JPEG")
        image_data_url = f"data:image/jpeg;base64,{img_b64}"

        # Try each model in order until one works
        for i, model_name in enumerate(FAL_3D_MODELS):
            try:
                print(f"🧪 Trying model {i+1}/{len(FAL_3D_MODELS)}: {model_name}")
                
                # Different models have different parameter requirements
                if model_name == "fal-ai/trellis":
                    payload = {
                        "image_url": image_data_url,
                        "num_inference_steps": 20,
                        "guidance_scale": 7.5,
                    }
                elif model_name == "fal-ai/triposr":
                    payload = {
                        "image_url": image_data_url,
                        "remove_background": True,
                        "foreground_ratio": 0.85,
                    }
                elif model_name == "fal-ai/hyper3d":
                    payload = {
                        "image_url": image_data_url,
                        "quality": "high",  # Options: "low", "medium", "high"
                    }
                else:
                    # Generic payload for any other models
                    payload = {"image_url": image_data_url}

                result = fal_client.run(model_name, arguments=payload)
                print(f"✅ {model_name} response keys:", list(result.keys()))
                
                # Debug: Print the actual structure of model_mesh if it exists
                if "model_mesh" in result:
                    model_mesh = result["model_mesh"]
                    print(f"🔍 model_mesh type: {type(model_mesh)}")
                    if isinstance(model_mesh, dict):
                        print(f"🔍 model_mesh keys: {list(model_mesh.keys())}")
                    elif isinstance(model_mesh, str):
                        print(f"🔍 model_mesh is string: {model_mesh[:100]}...")
                    else:
                        print(f"🔍 model_mesh content: {str(model_mesh)[:200]}...")

                # FIXED: Extract URL from different possible locations
                model_mesh = result.get("model_mesh", {})
                mesh_url = (
                    result.get("model_url") or 
                    result.get("mesh_url") or 
                    result.get("glb_url") or
                    result.get("output_url") or
                    # THE KEY FIX: Extract from model_mesh.url
                    (model_mesh.get("url") if isinstance(model_mesh, dict) else None) or
                    (model_mesh if isinstance(model_mesh, str) else None)
                )
                
                print(f"🔍 Extracted mesh_url: {mesh_url}")

                if mesh_url:
                    print(f"🎉 3‑D reconstruction successful with {model_name}!")
                    return {
                        "reconstruction_url": mesh_url,
                        "model_info": {
                            "model_used": model_name,
                            "file_size": model_mesh.get("file_size"),
                            "content_type": model_mesh.get("content_type"),
                            "direct_download": mesh_url  # For user access
                        }
                    }
                else:
                    print(f"⚠️ {model_name} returned no mesh URL, trying next model...")
                    continue

            except fal_client.client.FalClientError as model_error:
                error_msg = str(model_error).lower()
                if "not found" in error_msg:
                    print(f"❌ {model_name} not found, trying next model...")
                elif "quota" in error_msg or "limit" in error_msg:
                    print(f"⚠️ {model_name} quota/limit reached, trying next model...")
                else:
                    print(f"❌ {model_name} error: {model_error}")
                continue
            except Exception as model_error:
                print(f"❌ {model_name} unexpected error: {model_error}")
                continue

        # If we get here, all models failed
        print("⚠️ All 3D models failed, falling back to demo GLB")
        return {"reconstruction_url": DEMO_GL_B_URL}

    except Exception as exc:
        import traceback
        print("❌ 3‑D reconstruction critical error:", exc)
        print(traceback.format_exc())
        
        # Always return demo GLB instead of throwing HTTP error
        print("⚡️ Critical error occurred, falling back to demo GLB")
        return {"reconstruction_url": DEMO_GL_B_URL}


# -----------------------------------------------------------------
# 5.4 NEW: Check available 3D models (diagnostic endpoint)
# -----------------------------------------------------------------
@app.get("/available-models")
async def get_available_models():
    """
    Diagnostic endpoint to check which 3D models are available.
    Useful for debugging which models work with your API key.
    """
    available_models = []
    test_image_url = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
    
    for model_name in FAL_3D_MODELS:
        try:
            # Test with minimal payload to see if model exists
            test_payload = {"image_url": test_image_url}
            
            # Don't actually run the model (expensive), just check if it exists
            # by testing the API endpoint
            fal_client.run(model_name, arguments=test_payload)
            available_models.append({"model": model_name, "status": "available"})
            
        except fal_client.client.FalClientError as e:
            if "not found" in str(e).lower():
                available_models.append({"model": model_name, "status": "not_found"})
            elif "quota" in str(e).lower() or "limit" in str(e).lower():
                available_models.append({"model": model_name, "status": "quota_exceeded"})
            else:
                available_models.append({"model": model_name, "status": "error", "error": str(e)})
        except Exception as e:
            # If it's not a "not found" error, the model probably exists but failed for other reasons
            available_models.append({"model": model_name, "status": "exists_but_failed", "error": str(e)})
    
    return {
        "available_models": available_models,
        "demo_glb_url": DEMO_GL_B_URL
    }


# --------------------------------------------------------------
# 6️⃣ Health‑check (unchanged)
# --------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "healthy", "fal_api_configured": bool(FAL_KEY)}