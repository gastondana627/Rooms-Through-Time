// src/api.ts

/**
 * Determines the base URL for the API.
 * In development, it uses a relative path to leverage the Vite proxy.
 * In production, it uses the full URL provided by an environment variable.
 */
/**
 * Determines the base URL for the API.
 * - In dev: relative path, Vite proxy handles backend
 * - In prod: explicit env var VITE_API_BASE_URL
 */
const API_BASE_URL = import.meta.env.PROD
? import.meta.env.VITE_API_BASE_URL || ''
: '';

if (import.meta.env.PROD && !import.meta.env.VITE_API_BASE_URL) {
console.error("FATAL: VITE_API_BASE_URL is not set in the production environment!");
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
const url = `${API_BASE_URL}${endpoint}`;

const res = await fetch(url, {
  headers: { "Content-Type": "application/json" },
  ...options,
});

if (!res.ok) {
  const errorBody = await res.text();
  console.error(`[API ERROR] ${res.status} ${res.statusText}`, errorBody);
  throw new Error(`API error: ${res.status} ${res.statusText}`);
}

return res.json() as Promise<T>;
}

// ---- API wrappers for Railway Backend ----

export async function segment(data: { image_url: string | null }) {
return request<any>("/segment", {
  method: "POST",
  body: JSON.stringify(data),
});
}

export async function recolor(data: {
image_url: string | null;
mask: any;
color: number[];
}) {
return request<any>("/recolor", {
  method: "POST",
  body: JSON.stringify(data),
});
}

export async function reconstruct(data: { image_url: string | null }) {
return request<any>("/reconstruct", {
  method: "POST",
  body: JSON.stringify(data),
});
}

// ✅ NEW: Generate voiceover
export async function generateVoiceover(data: { image_url: string; style: string }) {
return request<any>("/generate-voiceover", {
  method: "POST",
  body: JSON.stringify(data),
});
}