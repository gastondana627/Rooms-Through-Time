# --------------------------------------------------------------
# main.py
# --------------------------------------------------------------
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
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
import traceback
import httpx
import random

# Optional ElevenLabs import
try:
    from elevenlabs.client import ElevenLabs
except Exception:
    ElevenLabs = None

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
    allow_origins=["*"], # Allow all for simplicity in dev
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

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
eleven_client = None
if ELEVENLABS_API_KEY and ElevenLabs is not None:
    try:
        eleven_client = ElevenLabs(api_key=ELEVENLABS_API_KEY)
        print("✅ ElevenLabs API key configured successfully")
    except Exception as e:
        logger.exception("Failed to create ElevenLabs client: %s", e)
else:
    if ELEVENLABS_API_KEY and ElevenLabs is None:
        logger.warning("ElevenLabs SDK import failed.")
    elif not ELEVENLABS_API_KEY:
        logger.info("ELEVENLABS_API_KEY not set; voice features disabled.")

# --------------------------------------------------------------
# 4️⃣  Constants & Data
# --------------------------------------------------------------
FAL_3D_MODELS = [ "fal-ai/triposr" ]
DEMO_GL_B_URL = "https://modelviewer.dev/shared-assets/models/Astronaut.glb"

DESIGNER_QUOTES = [
    "Have nothing in your house that you do not know to be useful, or believe to be beautiful.",
    "The essence of interior design will always be about people and how they live.",
    "A room should never allow the eye to settle in one place. It should smile at you and create fantasy.",
    "Design is a plan for arranging elements in such a way as best to accomplish a particular purpose.",
    "The best rooms have something to say about the people who live in them.",
    "Innovation is often the ability to reach into the past and bring back what is good, what is beautiful, what is useful, what is lasting."
]

# --------------------------------------------------------------
# 5️⃣  Pydantic Request Models
# --------------------------------------------------------------
class SegmentRequest(BaseModel): image_url: str
class RecolorRequest(BaseModel): image_url: str; mask: dict; color: list
class ReconstructRequest(BaseModel): image_url: str
class AudioRequest(BaseModel): image_url: str; style: str
class ImageGenerateRequest(BaseModel): prompt: str
class RedesignRequest(BaseModel):
    image_url: str
    prompt: str

# --------------------------------------------------------------
# 6️⃣  Helper Utilities
# --------------------------------------------------------------
def base64_to_image(b64: str) -> Image.Image:
    if b64.startswith("data:image"): b64 = b64.split(",", 1)[1]
    img_bytes = base64.b64decode(b64.strip())
    img = Image.open(io.BytesIO(img_bytes))
    return img.convert("RGB") if img.mode != "RGB" else img

def image_to_base64(image: Image.Image, fmt: str = "JPEG") -> str:
    buf = io.BytesIO()
    if fmt.upper() == "JPEG" and image.mode != "RGB": image = image.convert("RGB")
    image.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()

# ==============================================================
# API ROUTES
# ==============================================================
@app.get("/health")
async def health_check():
    return {"status": "healthy", "fal_api_configured": bool(FAL_KEY)}

@app.post("/generate-fal-image")
async def generate_fal_image(request: ImageGenerateRequest):
    try:
        print(f"🎨 Generating image with prompt: '{request.prompt}'")
        result = fal_client.run("fal-ai/stable-diffusion-v3-medium", arguments={"prompt": request.prompt})
        image_url = result["images"][0]["url"]
        print(f"✅ Image generated successfully: {image_url}")
        return {"image_url": image_url}
    except Exception as e:
        logger.exception("❌ Fal.ai image generation error: %s", e)
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

@app.post("/redesign-fal-image")
async def redesign_fal_image(request: RedesignRequest):
    try:
        print("🎨 Backend: Starting image redesign workflow…")
        print("   - Generating text prompt from image...")
        llava_result = fal_client.run("fal-ai/llava-next", arguments={ "image_url": request.image_url, "prompt": request.prompt })
        print("🔍 LLaVA raw result:", llava_result)
        redesign_prompt = ""
        if "output" in llava_result: redesign_prompt = llava_result["output"]
        elif "text" in llava_result: redesign_prompt = llava_result["text"]
        elif "outputs" in llava_result and len(llava_result["outputs"]) > 0: redesign_prompt = llava_result["outputs"][0].get("text", "")
        if not redesign_prompt: raise Exception(f"Unexpected LLaVA result format: {llava_result}")
        print(f"   - Generated Redesign Prompt: '{redesign_prompt}'")
        print("   - Generating new image from prompt...")
        image_result = fal_client.run("fal-ai/stable-diffusion-v3-medium", arguments={ "prompt": redesign_prompt })
        image_url = image_result["images"][0]["url"]
        print(f"✅ Redesign image generated successfully: {image_url}")
        return {"image_url": image_url}
    except Exception as e:
        logger.exception("❌ Fal.ai redesign workflow error: %s", e)
        raise HTTPException(status_code=500, detail=f"Image redesign failed: {str(e)}")

# ✅ UPDATED: The /segment endpoint now uses a text prompt to get detailed object masks.
@app.post("/segment")
async def segment_image(request: SegmentRequest):
    try:
        print("🔍 Backend: Starting image segmentation…")
        result = fal_client.run("fal-ai/sam2/image", arguments={
            "image_url": request.image_url,
            "prompts": [{ "type": "text", "data": "everything" }],
            "multimask_output": True
        })
        return result
    except Exception as exc:
        logger.exception("❌ Backend segmentation error: %s", exc)
        raise HTTPException(status_code=500, detail=f"Segmentation failed: {exc}")

@app.post("/recolor")
async def recolor_object(request: RecolorRequest):
    try:
        print("🎨 Backend: Starting recolor...")
        img = base64_to_image(request.image_url)
        mask_b64 = request.mask.get("mask", "")
        if not mask_b64: raise ValueError("Mask payload is empty")
        if mask_b64.startswith("data:image"): mask_b64 = mask_b64.split(",", 1)[1]
        mask_bytes = base64.b64decode(mask_b64)
        mask_img = Image.open(io.BytesIO(mask_bytes)).convert("L")
        colour = tuple(request.color)
        overlay = Image.new("RGB", img.size, colour)
        recoloured = Image.composite(overlay, img, mask_img)
        recoloured_b64 = image_to_base64(recoloured, fmt="JPEG")
        return {"image_url": f"data:image/jpeg;base64,{recoloured_b64}"}
    except Exception as exc:
        logger.exception("❌ Recolor error: %s", exc)
        return {"image_url": request.image_url}

@app.post("/reconstruct")
async def reconstruct_3d(request: ReconstructRequest):
    try:
        print("🪐 Backend: Starting 3-D reconstruction with TripoSR…")
        result = fal_client.run("fal-ai/triposr", arguments={ "image_url": request.image_url })
        print("TripoSR raw result for debugging:", result)
        model_mesh = result.get("model_mesh", {})
        mesh_url = model_mesh.get("url")
        if not mesh_url and "model_url" in result: mesh_url = result.get("model_url")
        if not mesh_url: raise Exception("3D model generation succeeded but returned no usable URL.")
        print(f"✅ 3D Model generated successfully: {mesh_url}")
        return { "reconstruction_url": mesh_url, "model_info": { "model_used": "fal-ai/triposr", "file_size": model_mesh.get("file_size"), "content_type": model_mesh.get("content_type"), "direct_download": mesh_url } }
    except Exception as exc:
        logger.exception("❌ Backend reconstruction error: %s", exc)
        return {"reconstruction_url": DEMO_GL_B_URL, "model_info": {"model_used": "fallback"}}

@app.post("/generate-voiceover")
async def generate_voiceover(request: AudioRequest):
    if eleven_client is None:
        raise HTTPException(status_code=503, detail="Voice feature unavailable")
    try:
        print("🎙️ Generating dynamic voiceover description...")
        gpt_result = fal_client.run("fal-ai/llava-next", arguments={
            "prompt": f"You are an eloquent interior designer. In under 40 words, describe this {request.style} room.",
            "image_url": request.image_url
        })
        description_text = gpt_result["output"]
        print(f"   - Generated Description: '{description_text}'")
        audio_stream = eleven_client.text_to_speech.convert( voice_id="21m00Tcm4TlvDq8ikWAM", text=description_text )
        os.makedirs("dist", exist_ok=True)
        audio_file_path = os.path.join("dist", "description.mp3")
        with open(audio_file_path, "wb") as f:
            for chunk in audio_stream: f.write(chunk)
        audio_url = "/description.mp3"
        print(f"✅ Voiceover audio saved and available at {audio_url}")
        return {"voiceover_url": audio_url, "description": description_text}
    except Exception as e:
        logger.exception("❌ Voiceover generation failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to generate voiceover: {str(e)}")

@app.get("/get-designer-quote")
async def get_designer_quote():
    print("🤔 Selecting a designer quote...")
    quote = random.choice(DESIGNER_QUOTES)
    print(f"   - Selected Quote: '{quote}'")
    return {"quote": quote}

# This must come *after* all the API routes are defined.
if os.path.isdir("dist"):
    app.mount("/", StaticFiles(directory="dist", html=True), name="frontend")
    print("✅ Static front‑end mounted from ./dist")
else:
    print("ℹ️ dist/ directory not found at startup — frontend static mount skipped.")