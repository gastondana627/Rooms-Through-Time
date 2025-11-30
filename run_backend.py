#!/usr/bin/env python3
import os
from dotenv import load_dotenv

# Load environment from backend/.env
load_dotenv('backend/.env')

# Verify FAL_KEY is loaded
if not os.getenv('FAL_KEY'):
    print("❌ ERROR: FAL_KEY not found in backend/.env")
    exit(1)

print(f"✅ FAL_KEY loaded: {os.getenv('FAL_KEY')[:20]}...")

# Start uvicorn
import uvicorn
uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=False)
