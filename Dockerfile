# Use Python 3.12 slim image
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install Python dependencies
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Copy the entire application
COPY . .

# Expose port (Railway will override with $PORT)
EXPOSE 8000

# Start command
CMD python3 -m uvicorn backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
