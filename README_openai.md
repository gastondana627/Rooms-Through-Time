# AI Room Designer – OpenAI OSS Hackathon Extension

This document explains the new **OpenAI OSS GPT integration** added to the AI Room Designer project for submission to the **Devpost OpenAI Open Model Hackathon (Sept 2025)**.

---

## 📌 Project Summary
AI Room Designer is a full-stack web app that transforms interior design through generative AI.  
Originally built for the Nano Banana Hackathon (Sept 6–8, 2025) using **Gemini 2.5, Fal.ai, and ElevenLabs**, the app now integrates **OpenAI OSS GPT models** to add reasoning, narration, and enhanced user experience.

---

## 🆕 New Hackathon Feature: GPT OSS Narration
- **Room Narrator AI** – Uses OpenAI OSS GPT (`gpt-oss-20B` or `gpt-oss-120B`) to generate a descriptive voiceover of each designed room.  
- **Dramatic Loading Effect** – While the image render loads, GPT OSS produces a narration like:  
  > “This Scandinavian layout emphasizes natural oak textures, soft blue accents, and minimalist flow.”  
- **Voice Integration** – ElevenLabs API converts narration into natural audio playback.  
- **Seamless Flow** – Users first hear the narration, then see the visual design once loading completes.

---

## 🛠️ Technical Flow
1. **Frontend (React)** requests narration after user selects design style.  
2. **Backend (FastAPI)** calls:
   - GPT OSS for text generation.  
   - ElevenLabs for text-to-speech audio.  
3. Response returns `{ text, audio_url }`.  
4. **NarrationPlayer.jsx** plays the audio while the design image is generated.  

---

## 🚀 Submission Notes
- This extension qualifies as a **fresh build** since OSS GPT is a new required component.  
- Existing stack (Gemini + Fal + ElevenLabs) is retained but now orchestrated with GPT OSS.  
- Focus is on **creativity + integration** rather than raw compute.

---