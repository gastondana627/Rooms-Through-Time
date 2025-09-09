/* src/api.ts */

// Get the API base URL from environment variables
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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