
# AI Room Designer

A full‑stack web app that lets you **generate, edit, and reconstruct** interior‑design images with AI.

- **Frontend** – React + Vite, runs on `http://localhost:5173` (dev) or is served statically by Railway.  
- **Backend** – FastAPI, exposes `/segment`, `/recolor`, `/reconstruct` and a `/health` endpoint.  
- **AI services** – Uses **Google Gemini**, **Google Imagen**, and **Fal AI** 3‑D reconstruction models.

---

## Table of Contents
1. [Prerequisites](#prerequisites)  
2. [Local Development](#local-development)  
3. [Environment Variables](#environment-variables)  
4. [Testing the Fal API Locally](#testing-the-fal-api-locally)  
5. [Deploying to Railway](#deploying-to-railway)  
6. [License](#license)

---

## Prerequisites

| Tool | Minimum version |
|------|-----------------|
| **Python** | 3.11 (or any 3.10+ compatible) |
| **Node.js** | 20.x (Railway uses Node 20; `nvm use 20` locally) |
| **npm** | 9.x (bundled with Node 20) |
| **Git** | any recent version |

---

## Local Development

### 1️⃣ Clone the repo (if you haven’t already)

```bash
git clone https://github.com/your‑username/Rooms-Through-Time.git
cd Rooms-Through-Time

2️⃣ Install backend dependencies
# From the repo root (the folder that contains requirements.txt)
pip install -r backend/requirements.txt

You should see a clean “Successfully installed …” output.
3️⃣ Install frontend dependencies
npm ci          # reads the existing package‑lock.json and installs exact versions

4️⃣ Set up your .env file (backend)
Create a file called .env in the backend folder (or in the repo root – load_dotenv() will pick it up).  
# backend/.env
FAL_KEY=YOUR_FAL_API_KEY
# (optional) other keys you might use, e.g.
GOOGLE_AI_API_KEY=YOUR_GOOGLE_GENAI_KEY
ELEVENLABS_API_KEY=YOUR_ELEVENLABS_KEY

⚠️ Do NOT commit this file – it’s listed in .gitignore.  
5️⃣ Run the servers
Open two terminal windows (or use tmux/pane).
Backend (Terminal 1)
cd backend
uvicorn main:app --reload --host 127.0.0.1 --port 8000

You should see:
✅ FAL API key configured successfully
INFO:     Uvicorn running on http://127.0.0.1:8000

Frontend (Terminal 2 – repo root)
npm run dev

Vite will launch at https://localhost:5173 (or http://localhost:5173).
Open the URL, click Generate Image, Magic Edit, Reconstruct in 3D – everything should work.
Environment Variables
Variable	Where it’s used	Example value
FAL_KEY	Backend (backend/main.py) – required for Fal AI calls.	sk‑…
VITE_GOOGLE_AI_API_KEY	Frontend – to call Gemini/Imagen.	AIza…
VITE_API_BASE_URL	Frontend – production URL for the API.	https://rooms-through-time-production.up.railway.app
GOOGLE_AI_API_KEY	Backend – optional if you call Gemini from the server (not used in current code).	…
ELEVENLABS_API_KEY	Backend – optional for future voice‑over features.	…
Railway: add the same FAL_KEY and any client‑side VITE_ variables in the Settings → Variables tab of your project. The backend reads FAL_KEY directly; the frontend reads the VITE_‑prefixed ones.
Testing the Fal API Locally
While the backend is running (uvicorn on 8000) you can hit the health endpoint:
curl http://127.0.0.1:8000/health
# Expected → {"status":"healthy","fal_api_configured":true}

If you want to test a single Fal call:
curl -X POST http://127.0.0.1:8000/segment \
     -H "Content-Type: application/json" \
     -d '{"image_url":"data:image/jpeg;base64,<YOUR_BASE64_DATA>"}'

Replace <YOUR_BASE64_DATA> with a tiny Base64‑encoded image (you can grab one from the UI console).  
You should get back a JSON payload with a segments array. If you receive a 500 or a message about “invalid API key”, double‑check that FAL_KEY in .env matches the real key.
Deploying to Railway
You already have a .nixpacks.toml that tells Railway how to build:
[phases.setup]
nixPkgs = ["python311", "nodejs-20_x"]

[phases.install]
cmds = [
  "pip install -r backend/requirements.txt",
  "npm ci"
]

[phases.build]
cmds = [
  "npm run build"
]

[start]
cmd = "cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT"

When you push, Railway will:
Install Python 3.11 + Node 20.  
Run pip install -r backend/requirements.txt.  
Run npm ci (uses the lock‑file you already have).  
Run npm run build → produces dist/.  
Start the FastAPI server.
Make sure you have added the Railway domain to CORS in backend/main.py (you already did).
License
MIT – feel free to fork, modify, and deploy.






