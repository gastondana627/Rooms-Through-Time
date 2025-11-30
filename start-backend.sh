#!/bin/bash

# Load environment variables from backend/.env
export $(cat backend/.env | grep -v '^#' | xargs)

# Start the backend
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
