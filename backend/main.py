import base64
import io
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from PIL import Image
import fal_serverless

# --- Pydantic Models for Request Data ---
class ImageUrlInput(BaseModel):
    image_url: str

class RecolorInput(BaseModel):
    image_url: str
    mask: dict # The specific mask for the object to recolor
    color: tuple[int, int, int] # e.g., (255, 0, 0) for red

# --- Initialize FastAPI App ---
app = FastAPI()

# IMPORTANT: Add CORS middleware to allow requests from your React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # Your React app's address
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Initialize Fal Client ---
fal_serverless.config(
    credentials="FAL_AI_KEY:FAL_AI_SECRET" # Replace with your actual Fal key/secret if needed
)

# --- API Endpoint 1: Segment Image ---
@app.post("/segment")
def segment_image(input: ImageUrlInput):
    """Takes an image URL and returns a list of segmented objects."""
    print("Received request to segment image...")
    result = fal_serverless.run(
        "fal-ai/fast-segment-anything",
        arguments={"image_url": input.image_url}
    )
    print("Segmentation complete.")
    return result

# --- Helper Function to Decode Base64 Image ---
def decode_base64_image(data_url: str) -> Image.Image:
    """Decodes a base64 data URL into a Pillow Image."""
    header, encoded = data_url.split(",", 1)
    binary_data = base64.b64decode(encoded)
    return Image.open(io.BytesIO(binary_data)).convert("RGBA")

# --- API Endpoint 2: Recolor Object ---
@app.post("/recolor")
def recolor_object(input: RecolorInput):
    """Takes an image, a mask, and a color, and returns the recolored image."""
    print(f"Received request to recolor object with color {input.color}")
    
    # 1. Load the original image
    original_image = decode_base64_image(input.image_url)

    # 2. Create the mask from the segmentation data
    mask_data = base64.b64decode(input.mask['mask'])
    mask_image = Image.open(io.BytesIO(mask_data)).convert("L") # Grayscale mask
    
    # 3. Create a solid color layer
    color_layer = Image.new("RGBA", original_image.size, input.color + (255,))

    # 4. Composite the images: Paste the color layer onto the original, using the mask
    recolored_image = Image.composite(color_layer, original_image, mask_image)

    # 5. Convert the final image back to base64 to send to the frontend
    buffered = io.BytesIO()
    recolored_image.save(buffered, format="PNG")
    img_str = base64.b64encode(buffered.getvalue()).decode("utf-8")
    
    print("Recoloring complete.")
    return {"image_url": f"data:image/png;base64,{img_str}"}

# --- Root endpoint for testing ---
@app.get("/")
def read_root():
    return {"message": "Python CV Backend is running!"}