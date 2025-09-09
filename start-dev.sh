#!/bin/bash

# Development startup script for AI Room Designer
echo "🚀 Starting AI Room Designer Development Environment"

# Check if Python virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Creating one..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source venv/bin/activate

# Install Python dependencies
echo "📥 Installing Python dependencies..."
pip install -q fastapi uvicorn python-dotenv pillow fal-client elevenlabs httpx

# Check if .env files exist
if [ ! -f "backend/.env" ]; then
    echo "❌ backend/.env not found. Please create it with your FAL_KEY"
    exit 1
fi

# Update .env for local development
echo "🔧 Configuring for local development..."
sed -i.bak 's|VITE_API_BASE_URL=https://rooms-through-time-production.up.railway.app|# VITE_API_BASE_URL=https://rooms-through-time-production.up.railway.app|' .env
sed -i.bak 's|# VITE_API_BASE_URL=http://127.0.0.1:8000|VITE_API_BASE_URL=http://127.0.0.1:8000|' .env

echo "🎯 Starting backend server..."
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!
cd ..

echo "⏳ Waiting for backend to start..."
sleep 3

echo "🎨 Starting frontend development server..."
npm run dev &
FRONTEND_PID=$!

echo "✅ Development servers started!"
echo "   Backend:  http://127.0.0.1:8000"
echo "   Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"

# Wait for user to stop
trap "echo '🛑 Stopping servers...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait