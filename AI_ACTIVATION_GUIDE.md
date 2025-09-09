# AI Activation Implementation Guide

## What I Fixed

### 1. API Configuration Issue
**Problem**: The frontend was making API calls to relative URLs without considering the environment configuration.

**Solution**: Updated `src/api.ts` to use the `VITE_API_BASE_URL` environment variable:
```typescript
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
```

### 2. Environment Configuration
**Problem**: Conflicting API base URLs in `.env` file.

**Solution**: Cleaned up the configuration to use Railway URL by default, with commented localhost option for development.

### 3. Development Workflow
**Problem**: No easy way to run both frontend and backend together.

**Solution**: Created `start-dev.sh` script for local development.

## How AI Activation Works

### Backend Flow (`/segment` endpoint):
1. Receives image URL from frontend
2. Calls FAL AI's SAM2 model for image segmentation
3. Returns masks/segments that identify different objects in the image
4. Frontend displays clickable overlay segments

### Frontend Flow:
1. User clicks "Activate AI Vision" (eye icon)
2. Calls `handleSegmentImage()` function
3. Makes POST request to `/segment` with current image URL
4. Displays interactive segments over the image
5. User can click segments to recolor objects

## Quick Setup for Development

### 1. Start Development Servers
```bash
./start-dev.sh
```

This will:
- Activate Python virtual environment
- Install required dependencies
- Start backend on http://127.0.0.1:8000
- Start frontend on http://localhost:5173
- Configure environment for local development

### 2. Test AI Activation
```bash
node test-ai-activation.js
```

This will verify:
- Backend health and FAL API configuration
- Segmentation endpoint functionality

## Production Deployment

### For Vercel/Railway Frontend:
The current configuration uses:
```
VITE_API_BASE_URL=https://rooms-through-time-production.up.railway.app
```

### For Railway Backend:
Make sure these environment variables are set:
- `FAL_KEY`: Your FAL AI API key
- `ELEVENLABS_API_KEY`: Your ElevenLabs API key (optional)

## Troubleshooting

### AI Activation Not Working?

1. **Check Backend Status**:
   ```bash
   curl http://127.0.0.1:8000/health
   ```

2. **Verify FAL API Key**:
   - Check `backend/.env` has correct `FAL_KEY`
   - Test key at https://fal.ai/dashboard

3. **Check Browser Console**:
   - Look for CORS errors
   - Check network tab for failed requests

4. **Common Issues**:
   - Backend not running: Run `./start-dev.sh`
   - Wrong API URL: Check `VITE_API_BASE_URL` in `.env`
   - Invalid FAL key: Update `backend/.env`

### Expected Behavior:
1. Generate or upload an image
2. Click the eye icon (Activate AI Vision)
3. See loading state
4. Segments appear as clickable overlays
5. Click segments to recolor objects
6. Click X to exit AI vision mode

## API Endpoints

- `POST /segment`: Image segmentation
- `POST /recolor`: Object recoloring  
- `POST /generate-fal-image`: Image generation
- `POST /redesign-fal-image`: Image redesign
- `POST /reconstruct`: 3D reconstruction
- `GET /health`: Backend health check

The AI activation feature is now properly configured and should work in both development and production environments!