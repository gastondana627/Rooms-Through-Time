# --------------------------------------------------------------
# main.py
# --------------------------------------------------------------
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
load_dotenv()
app = FastAPI(title="AI Room Designer API")

# --------------------------------------------------------------
# 2️⃣  CORS – keep it (harmless now that UI & API share origin)
# --------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://localhost:5173",
        "http://127.0.0.1:5173",
        "https://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "https://rooms-through-time.vercel.app",
        "https://rooms-through-time-production.up.railway.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------------------
# 3️⃣  Fal.AI configuration
# --------------------------------------------------------------
FAL_KEY = os.getenv("FAL_KEY")
if not FAL_KEY:
    raise ValueError("FAL_KEY environment variable is required")
print("✅ FAL API key configured successfully")
fal_client.api_key = FAL_KEY

# --------------------------------------------------------------
# 4️⃣  3‑D model slugs & demo GLB fallback
# --------------------------------------------------------------
FAL_3D_MODELS = [
    "fal-ai/trellis",
    "fal-ai/triposr",
    "fal-ai/hyper3d",
]

DEMO_GL_B_URL = "https://modelviewer.dev/shared-assets/models/Astronaut.glb"

# --------------------------------------------------------------
# 5️⃣  Pydantic request models
# --------------------------------------------------------------
class SegmentRequest(BaseModel):
    image_url: str

class RecolorRequest(BaseModel):
    image_url: str
    mask: dict
    color: list

class ReconstructRequest(BaseModel):
    image_url: str

# --------------------------------------------------------------
# 6️⃣  Helper utilities – base64 ↔ Pillow.Image
# --------------------------------------------------------------
def base64_to_image(b64: str) -> Image.Image:
    if b64.startswith("data:image"):
        b64 = b64.split(",", 1)[1]
    img_bytes = base64.b64decode(b64.strip())
    img = Image.open(io.BytesIO(img_bytes))
    return img.convert("RGB") if img.mode != "RGB" else img

def image_to_base64(image: Image.Image, fmt: str = "JPEG") -> str:
    buf = io.BytesIO()
    if fmt.upper() == "JPEG" and image.mode != "RGB":
        image = image.convert("RGB")
    image.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()

# ==============================================================
# ✅ CHANGE: ALL API ROUTES ARE NOW DEFINED *BEFORE* THE STATIC MOUNT
# ==============================================================

# --------------------------------------------------------------
# 8️⃣  Root endpoint (simple health)
# --------------------------------------------------------------
@app.get("/")
async def root():
    return {"message": "AI Room Designer API is running"}

# --------------------------------------------------------------
# 9️⃣  Image Segmentation
# --------------------------------------------------------------
@app.post("/segment")
async def segment_image(request: SegmentRequest):
    try:
        print("🔍 Starting image segmentation…")
        pil_img = base64_to_image(request.image_url)
        img_b64 = image_to_base64(pil_img)

        w, h = pil_img.size
        centre = [w // 2, h // 2]

        payload = {
            "image_url": f"data:image/jpeg;base64,{img_b64}",
            "prompts": [{"type": "point", "point_coords": [centre], "point_labels": [1]}],
            "multimask_output": True,
        }

        result = fal_client.run("fal-ai/sam2/image", arguments=payload)

        segments = []
        for i, mask_info in enumerate(result.get("masks", [])):
            mask_url = mask_info["mask"]
            mask_b64 = mask_url.split(",", 1)[1] if mask_url.startswith("data:") else mask_url
            segments.append(
                {"label": f"Object {i + 1}", "mask": mask_b64, "confidence": mask_info.get("score", 0.8)}
            )
        return {"segments": segments}
    except Exception as exc:
        import traceback
        print("❌ Segmentation error:", exc)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {exc}")

# --------------------------------------------------------------
# 10️⃣ Recolor
# --------------------------------------------------------------
@app.post("/recolor")
async def recolor_object(request: RecolorRequest):
    try:
        img = base64_to_image(request.image_url)
        mask_b64 = request.mask.get("mask", "")
        if not mask_b64:
            raise ValueError("Mask payload is empty")
        mask_bytes = base64.b64decode(mask_b64)
        mask_img = Image.open(io.BytesIO(mask_bytes)).convert("L")

        colour = tuple(request.color)
        overlay = Image.new("RGB", img.size, colour)
        recoloured = Image.composite(overlay, img, mask_img)

        recoloured_b64 = image_to_base64(recoloured, fmt="JPEG")
        return {"image_url": f"data:image/jpeg;base64,{recoloured_b64}"}
    except Exception as exc:
        import traceback
        print("❌ Recolor error:", exc)
        print(traceback.format_exc())
        return {"image_url": request.image_url}

# --------------------------------------------------------------
# 11️⃣ 3‑D Reconstruction
# --------------------------------------------------------------
@app.post("/reconstruct")
async def reconstruct_3d(request: ReconstructRequest):
    try:
        print("🪐 Starting 3‑D reconstruction…")
        pil_img = base64_to_image(request.image_url)
        img_b64 = image_to_base64(pil_img, fmt="JPEG")
        image_data_url = f"data:image/jpeg;base64,{img_b64}"

        for i, model_name in enumerate(FAL_3D_MODELS):
            try:
                print(f"🧪 Trying model {i + 1}/{len(FAL_3D_MODELS)}: {model_name}")
                
                if model_name == "fal-ai/trellis":
                    payload = {"image_url": image_data_url, "num_inference_steps": 20, "guidance_scale": 7.5}
                elif model_name == "fal-ai/triposr":
                    payload = {"image_url": image_data_url, "remove_background": True, "foreground_ratio": 0.85}
                elif model_name == "fal-ai/hyper3d":
                    payload = {"image_url": image_data_url, "quality": "high"}
                else:
                    payload = {"image_url": image_data_url}

                result = fal_client.run(model_name, arguments=payload)
                print(f"✅ {model_name} keys:", list(result.keys()))
                
                model_mesh = result.get("model_mesh", {})
                mesh_url = (
                    result.get("model_url") or result.get("mesh_url") or result.get("glb_url")
                    or result.get("output_url") or (model_mesh.get("url") if isinstance(model_mesh, dict) else None)
                    or (model_mesh if isinstance(model_mesh, str) else None)
                )
                print(f"🔍 Extracted mesh_url: {mesh_url}")

                if mesh_url:
                    return {
                        "reconstruction_url": mesh_url,
                        "model_info": {
                            "model_used": model_name,
                            "file_size": (model_mesh.get("file_size") if isinstance(model_mesh, dict) else None),
                            "content_type": (model_mesh.get("content_type") if isinstance(model_mesh, dict) else None),
                            "direct_download": mesh_url,
                        },
                    }
                else:
                    print(f"⚠️ {model_name} returned no mesh URL – trying next...")
            except fal_client.client.FalClientError as e:
                msg = str(e).lower()
                if "not found" in msg: print(f"❌ {model_name} not found – trying next")
                elif "quota" in msg or "limit" in msg: print(f"⚠️ {model_name} quota exceeded – trying next")
                else: print(f"❌ {model_name} error: {e}")
            except Exception as e:
                print(f"❌ Unexpected error for {model_name}: {e}")

        print("⚠️ All models failed – returning demo GLB")
        return {"reconstruction_url": DEMO_GL_B_URL}
    except Exception as exc:
        import traceback
        print("❌ Critical reconstruction error:", exc)
        print(traceback.format_exc())
        return {"reconstruction_url": DEMO_GL_B_URL}

# --------------------------------------------------------------
# 12️⃣ Diagnostic endpoint – which 3‑D models are available?
# --------------------------------------------------------------
@app.get("/available-models")
async def get_available_models():
    test_image_url = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCggoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k="
    available = []
    for model_name in FAL_3D_MODELS:
        try:
            fal_client.run(model_name, arguments={"image_url": test_image_url})
            available.append({"model": model_name, "status": "available"})
        except fal_client.client.FalClientError as e:
            txt = str(e).lower()
            if "not found" in txt: available.append({"model": model_name, "status": "not_found"})
            elif "quota" in txt or "limit" in txt: available.append({"model": model_name, "status": "quota_exceeded"})
            else: available.append({"model": model_name, "status": "error", "error": str(e)})
        except Exception as e:
            available.append({"model": model_name, "status": "exists_but_failed", "error": str(e)})
    return {"available_models": available, "demo_glb_url": DEMO_GL_B_URL}

# --------------------------------------------------------------
# 13️⃣ Health‑check endpoint
# --------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "healthy", "fal_api_configured": bool(FAL_KEY)}

# --------------------------------------------------------------
# ✅ CHANGE: MOVED THE STATIC FILE MOUNT TO THE VERY END
# --------------------------------------------------------------
# This must come *after* all the API routes are defined.
if os.path.isdir("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="frontend")
    print("✅ Static front‑end mounted from ./dist")