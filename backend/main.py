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
import logging

# Optional ElevenLabs import — keep the import but handle missing key gracefully.
try:
    from elevenlabs.client import ElevenLabs
except Exception:
    ElevenLabs = None  # will check at runtime

# --------------------------------------------------------------
# 1️⃣  Load env-vars & start FastAPI
# --------------------------------------------------------------
load_dotenv()
app = FastAPI(title="AI Room Designer API")

logger = logging.getLogger("uvicorn.error")

# --------------------------------------------------------------
# 2️⃣  CORS Middleware
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
# 3️⃣  API Client Configurations
# --------------------------------------------------------------
FAL_KEY = os.getenv("FAL_KEY")
if not FAL_KEY:
    raise ValueError("FAL_KEY environment variable is required")
print("✅ FAL API key configured successfully")
fal_client.api_key = FAL_KEY

# ElevenLabs client: optional (do not crash if missing)
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
if ELEVENLABS_API_KEY and ElevenLabs is not None:
    try:
        eleven_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        print("✅ ElevenLabs API key configured successfully")
    except Exception as e:
        eleven_client = None
        logger.exception("Failed to create ElevenLabs client: %s", e)
else:
    eleven_client = None
    if ELEVENLABS_API_KEY and ElevenLabs is None:
        logger.warning("ElevenLabs SDK import failed; ElevenLabs endpoint will be unavailable.")
    else:
        logger.info("ELEVENLABS_API_KEY not set; voice features disabled (safe fallback).")

# --------------------------------------------------------------
# 4️⃣  Constants & Fallbacks
# --------------------------------------------------------------
FAL_3D_MODELS = [
    "fal-ai/trellis",
    "fal-ai/triposr",
    "fal-ai/hyper3d",
]
DEMO_GL_B_URL = "https://modelviewer.dev/shared-assets/models/Astronaut.glb"

# --------------------------------------------------------------
# 5️⃣  Pydantic Request Models
# --------------------------------------------------------------
class SegmentRequest(BaseModel):
    image_url: str

class RecolorRequest(BaseModel):
    image_url: str
    mask: dict
    color: list

class ReconstructRequest(BaseModel):
    image_url: str

# ✅ NEW: Pydantic model for the audio feature
class AudioRequest(BaseModel):
    image_url: str
    style: str

# --------------------------------------------------------------
# 6️⃣  Helper Utilities
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
# API ROUTES
# ==============================================================

@app.get("/health")
async def health_check():
    return {"status": "healthy", "fal_api_configured": bool(FAL_KEY)}

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
        logger.exception("❌ Segmentation error: %s", exc)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {exc}")

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
        logger.exception("❌ Recolor error: %s", exc)
        print(traceback.format_exc())
        # return original image on recolor failure — keeps UI stable
        return {"image_url": request.image_url}

@app.post("/reconstruct")
async def reconstruct_3d(request: ReconstructRequest):
    try:
        print("🪐 Starting 3-D reconstruction…")
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
                    result.get("model_url")
                    or result.get("mesh_url")
                    or result.get("glb_url")
                    or result.get("output_url")
                    or (model_mesh.get("url") if isinstance(model_mesh, dict) else None)
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
                if "not found" in msg:
                    print(f"❌ {model_name} not found – trying next")
                elif "quota" in msg or "limit" in msg:
                    print(f"⚠️ {model_name} quota exceeded – trying next")
                else:
                    print(f"❌ {model_name} error: {e}")
            except Exception as e:
                print(f"❌ Unexpected error for {model_name}: {e}")

        print("⚠️ All models failed – returning demo GLB")
        return {"reconstruction_url": DEMO_GL_B_URL}
    except Exception as exc:
        import traceback
        logger.exception("❌ Critical reconstruction error: %s", exc)
        print(traceback.format_exc())
        return {"reconstruction_url": DEMO_GL_B_URL}

@app.get("/available-models")
async def get_available_models():
    """
    Returns the list of configured FAL 3D models the backend will try.
    (Frontend can call this to show a 'models tried' debug panel.)
    """
    return {"models": FAL_3D_MODELS}

# ✅ NEW: ElevenLabs Voiceover Endpoint
@app.post("/generate-voiceover")
async def generate_voiceover(request: AudioRequest):
    """
    Generates a short voiceover MP3 for the redesigned room.
    - If ElevenLabs client is not configured, returns 503 with a friendly message.
    - Saves the MP3 into `dist/description.mp3` so it is served by StaticFiles.
    """
    if eleven_client is None:
        logger.warning("Voiceover requested but ElevenLabs client is not configured.")
        raise HTTPException(status_code=503, detail="Voice feature unavailable: ElevenLabs not configured")

    try:
        print("🎙️ Generating voiceover...")
        # You can customize this description template as needed
        description_text = f"This stunning {request.style} space evokes a sense of timeless elegance and comfort, perfect for relaxation and quiet contemplation."

        # Convert text to speech — adapt if the SDK's API differs in your installed version
        audio_stream = eleven_client.text_to_speech.convert(
            voice_id="21m00Tcm4TlvDq8ikWAM",  # Example voice id ("Rachel") — replace if needed
            text=description_text,
        )

        # Ensure the dist folder exists (so StaticFiles can serve the output)
        os.makedirs("dist", exist_ok=True)
        audio_file_path = os.path.join("dist", "description.mp3")

        # Stream write the response into a file
        with open(audio_file_path, "wb") as f:
            # The SDK may return an iterator/generator of bytes; adapt if your version returns bytes directly.
            if hasattr(audio_stream, "__iter__") and not isinstance(audio_stream, (bytes, bytearray)):
                for chunk in audio_stream:
                    f.write(chunk)
            else:
                # If the SDK returned bytes
                f.write(audio_stream)

        audio_url = "/description.mp3"
        print(f"✅ Voiceover audio saved and available at {audio_url}")
        return {"voiceover_url": audio_url, "description": description_text}
    except Exception as e:
        import traceback
        logger.exception("❌ Voiceover generation failed: %s", e)
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Failed to generate voiceover: {str(e)}")

# This must come *after* all the API routes are defined.
if os.path.isdir("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="frontend")
    print("✅ Static front-end mounted from ./dist")
else:
    print("ℹ️ dist/ directory not found at startup — frontend static mount skipped. (Build the frontend to create ./dist)")

    