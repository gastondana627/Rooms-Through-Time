# Ai Room Designer: Rooms Through Time 🏛️

ChronoCanvas is an AI-powered **Room Redesign + Narration Tool** built for the Nano Hackathon.  
Upload your room → watch it segmented + restyled → then hear a narrated description via ElevenLabs.

---

## 🚀 Features
- Upload any room photo.
- Automatic **segmentation** of walls, furniture, objects.
- Restyling via **OSS-powered transformations** (Modern, Classic, Minimalist, Industrial).
- Narrated **audio description** of the final style, generated with ElevenLabs.
- Works seamlessly on **localhost** (FastAPI backend) and **production** (Vercel serverless).

---

## 🔧 Tech Stack
- **Frontend:** React + TypeScript
- **Backend:** FastAPI + Vercel Serverless
- **AI Models:** OSS segmentation + stylization pipeline
- **Audio:** ElevenLabs API
- **Infra:** Railway (backend), Vercel (frontend), Localhost dev

---

## 📂 Project Structure
backend/
├── main.py
├── requirements.txt
frontend/
├── src/components/RoomScanner.tsx
├── src/components/NarrationPlayer.jsx
├── api/generate-voiceover.ts
├── App.tsx


---

## 🏆 Hackathon Relevance
This project builds on the earlier **Rooms Through Time** submission,  
but adds **live narration + OSS-powered room stylization** to make it fresh and unique.

Nano Hackathon Goal:  
> Demonstrate how **AI-generated narration + visual transformations** can enhance spatial design tools.


## ⚙️ Setup
```bash
# Backend (Railway / Localhost)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload

# Frontend (Vercel / Localhost)
npm install
npm run dev


Env Variables:
	•	ELEVENLABS_API_KEY=your_api_key_here


📜 License
MIT

