# --------------------------------------------------------------
# main.py
# --------------------------------------------------------------
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles          # <-- NEW import
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
        "http://127.0.0.1:8000",                     # local backend
        "https://rooms-through-time.vercel.app",      # Vercel‑hosted UI (if you ever use it)
        "https://rooms-through-time-production.up.railway.app",  # Railway UI + API
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
FAL_3D_MODEL = "fal-ai/triposr"
DEMO_GL_B_URL = "https://modelviewer.dev/shared-assets/models/Astronaut.glb"

# --------------------------------------------------------------
# 5️⃣  Pydantic request models
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
# 6️⃣  Helper utilities – base64 ↔ Pillow.Image
# --------------------------------------------------------------
def base64_to_image(b64: str) -> Image.Image:
    """Convert a data‑url or raw base64 string into a Pillow Image."""
    if b64.startswith("data:image"):
        b64 = b64.split(",", 1)[1]        # strip the mime‑type prefix
    img_bytes = base64.b64decode(b64.strip())
    img = Image.open(io.BytesIO(img_bytes))
    return img.convert("RGB") if img.mode != "RGB" else img


def image_to_base64(image: Image.Image, fmt: str = "JPEG") -> str:
    """Encode a Pillow Image to a base64 string (no data‑url prefix)."""
    buf = io.BytesIO()
    if fmt.upper() == "JPEG" and image.mode != "RGB":
        image = image.convert("RGB")
    image.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()


# --------------------------------------------------------------
# 7️⃣  **Serve the Vite build** (monorepo mode)
# --------------------------------------------------------------
# After `npm run build` the static files are placed in ./dist.
# When the container starts its working directory is /app,
# so "./dist" is the correct relative path.
if os.path.isdir("dist"):
    # `html=True` makes FastAPI fallback to index.html for any unknown route,
    # which lets React handle client‑side routing.
    app.mount(
        "/",                     # everything under the root URL
        StaticFiles(directory="dist", html=True),
        name="frontend",
    )
    print("✅ Static front‑end mounted from ./dist")

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
        img_b64 = image_to_base64(pil_img)          # JPEG for Fal

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
            mask_b64 = (
                mask_url.split(",", 1)[1]
                if mask_url.startswith("data:")
                else mask_url
            )
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
        raise HTTPException(
            status_code=500, detail=f"Segmentation failed: {exc}"
        )


# --------------------------------------------------------------
# 10️⃣  Recolor
# --------------------------------------------------------------
@app.post("/recolor")
async def recolor_object(request: RecolorRequest):
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
        # Return original image so UI never crashes
        return {"image_url": request.image_url}


# --------------------------------------------------------------
# 11️⃣  3‑D Reconstruction
# --------------------------------------------------------------
@app.post("/reconstruct")
async def reconstruct_3d(request: ReconstructRequest):
    try:
        print(f"🪐 Starting 3‑D reconstruction with {FAL_3D_MODEL}…")
        pil_img = base64_to_image(request.image_url)
        img_b64 = image_to_base64(pil_img, fmt="JPEG")
        image_data_url = f"data:image/jpeg;base64,{img_b64}"

        payload = {
            "image_url": image_data_url,
            "remove_background": True,
            "foreground_ratio": 0.85,
        }

        result = fal_client.run(FAL_3D_MODEL, arguments=payload)
        print(f"✅ {FAL_3D_MODEL} result keys:", list(result.keys()))

        model_mesh = result.get("model_mesh", {})
        mesh_url = model_mesh.get("url") if isinstance(model_mesh, dict) else None

        if not mesh_url:
            print("❌ No mesh URL found in the result:", result)
            raise HTTPException(
                status_code=500,
                detail=f"3D model '{FAL_3D_MODEL}' did not return a mesh URL.",
            )

        print(f"✅ Successfully reconstructed 3D model: {mesh_url}")
        return {
            "reconstruction_url": mesh_url,
            "model_info": {
                "model_used": FAL_3D_MODEL,
                "file_size": model_mesh.get("file_size"),
                "content_type": model_mesh.get("content_type"),
                "direct_download": mesh_url,
            },
        }

    except fal_client.client.FalClientError as e:
        import traceback
        print("❌ Fal Client Error:", e)
        print(traceback.format_exc())
        raise HTTPException(status_code=502, detail=f"Fal AI API error: {e}")
    except Exception as exc:
        import traceback
        print("❌ Critical reconstruction error:", exc)
        print(traceback.format_exc())
        raise HTTPException(
            status_code=500, detail=f"An unexpected error occurred: {exc}"
        )


# --------------------------------------------------------------
# 12️⃣  Health‑check endpoint
# --------------------------------------------------------------
@app.get("/health")
async def health_check():
    return {"status": "healthy", "fal_api_configured": bool(FAL_KEY)}