# AI Room Designer

### An Intelligent, Multi-Modal Companion for Interior Design

**AI Room Designer** is a full-stack web application that transforms the interior design process. It's not just a tool; it's a creative partner that allows users to generate photorealistic rooms, redesign their own space from a photo, visualize their creations in an interactive 3D environment, and receive expert design advice from an intelligent, voice-driven AI companion.

---

## 🏆 Hackathon Evolution: From Tool to Companion

This project was born as a 48-hour sprint for the **Nano Banana Hackathon** and was significantly evolved for the **OpenAI Open Model Hackathon**.

The initial version was a powerful but static tool. For the OpenAI Hackathon, the application was transformed by integrating the **`gpt-oss-20b` model**, running as a **true local agent via LM Studio**. This gave the application a "soul," turning it into the **"AI Design Consultant"**—an interactive character that provides dynamic narration and context-aware design advice, showcasing a creative and unexpected use of open models.

Additionally, the 3D feature was upgraded to an **"Ultimate Quality" pipeline**, which uses AI to generate 36 unique camera angles from a single photo to create high-fidelity 3D assets.

---

## Table of Contents
1.  [Live Demo & Key Features](#live-demo--key-features)
2.  [Technology Stack & AI Models](#technology-stack--ai-models)
3.  [Prerequisites](#prerequisites)
4.  [Local Development & Testing](#local-development--testing)
5.  [Environment Variables](#environment-variables)
6.  [Deployment](#deployment)

---

## Live Demo & Key Features

**[Link to your Deployed Application on Vercel/Railway]**

*   **Generate & Redesign:** Create rooms from text or redesign your own space from a photo.
*   **Ultimate Quality 3D Reconstruction:** Transforms a 2D image into a high-fidelity, interactive 3D model using a multi-view AI pipeline.
*   **AI Design Consultant:** An interactive, voice-driven character powered by a local `gpt-oss-20b` model that provides dynamic descriptions and expert advice.
*   **AI Vision (Magic Edit):** Uses a segmentation model to identify and interactively recolor any object in the generated scene.
*   **36+ Design Styles:** A comprehensive library of styles with a smart randomization feature.

---

## Technology Stack & AI Models

| Category      | Technology / Model                               | Role                                       |
| :------------ | :----------------------------------------------- | :----------------------------------------- |
| **Frontend**  | `React`, `Vite`, `TypeScript`, `Tailwind CSS`      | User Interface & Experience                |
| **Backend**   | `Python`, `FastAPI`, `Uvicorn`                     | AI Orchestration Engine & Server           |
| **Hosting**   | `Vercel` (Frontend), `Railway` (Backend)           | Deployment & CI/CD                         |
| **The Brain** | **`gpt-oss-20b`** (via **LM Studio**)              | Local Agent, Chat, Reasoning               |
| **The Artists**| **Fal.ai** (`stable-diffusion`, `llava-next`, `sam2`, `triposr`) | Image Gen, Analysis, Segmentation, 3D      |
| **The Voice** | **ElevenLabs API**                               | High-Quality Text-to-Speech              |
| **3D Viewer** | `@google/model-viewer`                           | Interactive `.glb` Rendering               |

---

## Prerequisites

| Tool       | Minimum version                        |
| :--------- | :------------------------------------- |
| **Node.js**| 20.x                                   |
| **Python** | 3.10+                                  |
| **LM Studio**| Latest version from [lmstudio.ai](https://lmstudio.ai/) |

---

## Local Development & Testing

This project is built with a **local-first architecture**. Follow these steps to run the full, intelligent experience on your machine.

### Step 1: Set Up the Local AI Model (LM Studio)

1.  Open LM Studio.
2.  Search for and download the **`openai/gpt-oss-20b`** model.
3.  Navigate to the **"Local Server"** tab (`🌐`).
4.  Select the `gpt-oss-20b` model and click **"Start Server"**.
    *   *The server must be running at `http://localhost:1234/v1` for the chat feature to work.*

### Step 2: Configure Environment Variables

1.  Clone this repository: `git clone [your-repo-url]`
2.  In the project **root**, create a file named `.env`.
3.  Add your API keys and the local server URL:
    ```
    # For Fal.ai, ElevenLabs, etc.
    FAL_KEY="your_fal_api_key_here"
    ELEVENLABS_API_KEY="your_elevenlabs_api_key_here"

    # Tells the backend where to find your local GPT-OSS model
    CHAT_API_URL="http://localhost:1234/v1"
    ```
    *Note: A `.env.example` file is provided for reference.*

### Step 3: Run the Application

You will need **two terminal windows**.

**Terminal 1: Start the Frontend** (from the project root)
```bash
npm install
npm run dev

# Create and activate a Python virtual environment
python3 -m venv venv
source venv/bin/activate

# Install Python dependencies
pip install -r backend/requirements.txt

# Start the server
uvicorn backend.main:app --reload```

Your application will be live at `https://localhost:5173/`. All features, including the AI chat, will be fully functional.

---

## Environment Variables

| Variable          | Scope    | Required? | Description                                      |
| :---------------- | :------- | :-------- | :----------------------------------------------- |
| `FAL_KEY`         | Backend  | **Yes**   | API key for all Fal.ai visual models.            |
| `ELEVENLABS_API_KEY`| Backend  | Optional  | For voice generation. App has fallbacks.        |
| `CHAT_API_URL`    | Backend  | Optional  | URL for the local LM Studio server.              |
| `HF_TOKEN`        | Backend  | Optional  | Hugging Face key for future avatar generation.   |

---

## Deployment

The project is configured for seamless deployment on Vercel and Railway. The `railway.toml` file contains the necessary build and start commands for the backend. Ensure all environment variables are set in your respective hosting provider's project settings.
