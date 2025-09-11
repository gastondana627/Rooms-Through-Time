# 🚀 Local & Production Deployment Guide

## 🏠 Local Development (HTTP)

### Quick Start
```bash
# 1. Start Backend
cd backend && python main.py

# 2. Start Frontend (new terminal)
npm run dev

# 3. Open http://localhost:3000
```

### Environment Configuration
```bash
# .env file for local development
VITE_API_BASE_URL=http://localhost:8000
```

## ☁️ Production Deployment (HTTPS)

### Railway Backend + Vercel Frontend

#### Railway Backend Setup:
1. **Connect GitHub repo** to Railway
2. **Set environment variables**:
   ```
   HUGGINGFACE_API_KEY=hf_your_token_here
   OPENAI_API_KEY=sk-your_openai_key_here
   FAL_KEY=d2296766-86c7-480a-9b83-4ff7a400debd:3aeb66890c32e188f34e94b784b80f71
   ELEVENLABS_API_KEY=sk_7eb9264660a77a594c4d18e44e88d44933cacb7295914743
   DEPLOYMENT_MODE=cloud
   ```
3. **Deploy** - Railway auto-detects Python and runs `python main.py`

#### Vercel Frontend Setup:
1. **Connect GitHub repo** to Vercel
2. **Set environment variables**:
   ```
   VITE_API_BASE_URL=https://rooms-through-time-production.up.railway.app
   ```
3. **Deploy** - Vercel auto-detects Vite and builds

### Alternative: Railway Full-Stack

#### Single Railway Deployment:
1. **Backend + Frontend** in same Railway service
2. **Environment variables**:
   ```
   # Backend keys
   HUGGINGFACE_API_KEY=hf_your_token_here
   OPENAI_API_KEY=sk-your_openai_key_here
   FAL_KEY=d2296766-86c7-480a-9b83-4ff7a400debd:3aeb66890c32e188f34e94b784b80f71
   ELEVENLABS_API_KEY=sk_7eb9264660a77a594c4d18e44e88d44933cacb7295914743
   DEPLOYMENT_MODE=cloud
   
   # Frontend config
   VITE_API_BASE_URL=
   ```
3. **Build script** handles both frontend and backend

## 🔄 Smart Environment Switching

### Auto-Detection (Recommended)
```bash
# Leave empty for smart detection
VITE_API_BASE_URL=
```

The system automatically detects:
- **localhost** → `http://localhost:8000`
- **vercel.app** → Same origin
- **railway.app** → Railway backend URL
- **Other** → Same origin

### Manual Override
```bash
# Force specific environment
VITE_API_BASE_URL=https://your-backend.railway.app
```

## 🧪 Testing Both Environments

### Local Testing
```bash
# Test backend health
curl http://localhost:8000/health

# Test chat endpoint
curl -X POST http://localhost:8000/chat-with-avatar \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "character_name": "Test", "style": "Modern"}'
```

### Production Testing
```bash
# Test production health
curl https://rooms-through-time-production.up.railway.app/health

# Test production chat
curl -X POST https://rooms-through-time-production.up.railway.app/chat-with-avatar \
  -H "Content-Type: application/json" \
  -d '{"message": "test", "character_name": "Test", "style": "Modern"}'
```

## 🎯 Hackathon Demo Strategy

### Local Demo (Impressive)
1. **Show local-first architecture**
2. **Disconnect WiFi** - still works!
3. **Fast responses** - no network latency
4. **Privacy-first** - data stays local

### Production Demo (Scalable)
1. **Show cloud deployment**
2. **Global accessibility**
3. **Enhanced features** with cloud APIs
4. **Production-ready** architecture

### Hybrid Demo (Best of Both)
1. **Start local** - show offline capability
2. **Switch to production** - show scalability
3. **Compare performance** - local vs cloud
4. **Emphasize flexibility** - deploy anywhere

## 🏆 Judge Appeal Points

### Technical Excellence
- **Seamless environment switching**
- **Local-first with cloud scaling**
- **Production-ready deployment**
- **Smart auto-detection**

### Innovation
- **Offline-capable AI reasoning**
- **Hybrid architecture**
- **Multiple deployment strategies**
- **Developer-friendly configuration**

### Practicality
- **Works immediately** (local)
- **Scales globally** (cloud)
- **Easy deployment** (Railway/Vercel)
- **Flexible configuration**

Ready for both local demos and production deployment! 🚀