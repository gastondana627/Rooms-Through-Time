// src/api.ts

const API_BASE =
  import.meta.env.MODE === 'development'
    ? 'http://127.0.0.1:8000'
    : import.meta.env.VITE_API_BASE_URL;

// Small helper to DRY fetch logic
async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---- API wrappers ----
export async function segment(data: any) {
  return request("/segment", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function recolor(data: any) {
  return request("/recolor", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function reconstruct(data: any) {
  return request("/reconstruct", {
    method: "POST",
    body: JSON.stringify(data),
  });
}