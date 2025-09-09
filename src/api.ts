/* src/api.ts */

// Smart API Base URL Detection - Local & Production Ready
const getApiBaseUrl = () => {
  // If explicitly set in environment, use that
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl) {
    // Special case: if we're on HTTPS localhost and env points to HTTP localhost,
    // use empty string to leverage Vite proxy instead
    if (window.location.protocol === 'https:' && 
        window.location.hostname === 'localhost' && 
        envUrl.startsWith('http://localhost')) {
      console.log('🔄 Using Vite proxy for HTTPS → HTTP local development');
      return ''; // Use proxy
    }
    return envUrl;
  }
  
  // Auto-detection based on current environment
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Local development - use proxy for HTTPS, direct for HTTP
    if (window.location.protocol === 'https:') {
      return ''; // Use Vite proxy
    } else {
      return 'http://localhost:8000';
    }
  } else if (window.location.hostname.includes('vercel.app')) {
    // Vercel deployment - use serverless functions
    return ''; // Same origin
  } else if (window.location.hostname.includes('railway.app')) {
    // Railway deployment
    return 'https://rooms-through-time-production.up.railway.app';
  } else {
    // Default to same origin for other deployments
    return '';
  }
};

const API_BASE_URL = getApiBaseUrl();
console.log('🌐 API Base URL:', API_BASE_URL || 'Same Origin (Proxy)');

// A generic helper for POSTing JSON data and expecting a JSON response
const callBackendPost = async (endpoint: string, body: any) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Backend error for ${url}:`, errorBody);
    throw new Error(`Request to ${url} failed.`);
  }
  return await response.json();
};

// All functions that send data use the POST helper
export const generateFalImage = (input: { prompt: string }) => callBackendPost('/generate-fal-image', input);
export const redesignFalImage = (input: { image_url: string; prompt: string }) => callBackendPost('/redesign-fal-image', input);
export const segment = (input: { image_url: string }) => callBackendPost('/segment', input);
export const reconstruct = (input: { image_url: string }) => callBackendPost('/reconstruct', input);
export const recolor = (input: any) => callBackendPost('/recolor', input);
export const generateVoiceover = (input: { image_url: string; style: string }) => callBackendPost('/generate-voiceover', input);
export const chatWithAvatar = (input: { message: string; character_name: string; style: string; conversation_history?: any[] }) => callBackendPost('/chat-with-avatar', input);

// ✅ CORRECTED: A dedicated function for the GET endpoint that expects a JSON response with a "quote" key.
export const getDesignerQuote = async (): Promise<{ quote: string }> => {
  const url = `${API_BASE_URL}/get-designer-quote`;
  const response = await fetch(url, { method: 'GET' });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Backend error for ${url}:`, errorBody);
    throw new Error(`Request to ${url} failed.`);
  }
  // The backend returns a JSON object like {"quote": "..."}
  return await response.json();
};