/* src/api.ts */

// A generic helper for calling our backend endpoints
const callBackend = async (endpoint: string, body: any, method: 'GET' | 'POST' = 'POST') => {
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (method === 'POST') {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(endpoint, options);

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Backend error for ${endpoint}:`, errorBody);
    throw new Error(`Request to ${endpoint} failed.`);
  }
  return await response.json();
};

// All functions now use the reliable backend
export const generateFalImage = (input: { prompt: string }) => callBackend('/generate-fal-image', input);
export const redesignFalImage = (input: { image_url: string; prompt: string }) => callBackend('/redesign-fal-image', input);
export const segment = (input: { image_url: string }) => callBackend('/segment', input);
export const reconstruct = (input: { image_url: string }) => callBackend('/reconstruct', input);
export const recolor = (input: any) => callBackend('/recolor', input);
export const generateVoiceover = (input: { image_url: string; style: string }) => callBackend('/generate-voiceover', input);

// ✅ NEW: The missing function to call the quote endpoint.
export const getDesignerQuote = () => callBackend('/get-designer-quote', null, 'GET');