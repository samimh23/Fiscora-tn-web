import type { AuthResponse } from "../types/api";

const SESSION_KEY = "compta-tn.session";
export const SESSION_CHANGED_EVENT = "compta-tn:session-changed";
const API_BASE_URL = (import.meta.env.VITE_API_URL ?? "")
  .trim()
  .replace(/\/+$/, "");

function apiUrl(path: string) {
  if (!API_BASE_URL || /^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export class ApiError extends Error {
  public readonly status: number;
  public readonly details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function readSession(): AuthResponse | null {
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthResponse;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(session: AuthResponse | null) {
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else sessionStorage.removeItem(SESSION_KEY);
  window.dispatchEvent(new CustomEvent(SESSION_CHANGED_EVENT));
}

async function parseError(response: Response) {
  let details: unknown;
  try {
    details = await response.json();
  } catch {
    details = null;
  }
  const payload = details as { message?: string | string[] } | null;
  const message = Array.isArray(payload?.message)
    ? payload.message.join(" ")
    : payload?.message || "Une erreur inattendue est survenue.";
  return new ApiError(response.status, message, details);
}

async function refreshSession(): Promise<AuthResponse | null> {
  const current = readSession();
  if (!current?.refreshToken) return null;
  const response = await fetch(apiUrl("/api/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: current.refreshToken }),
  });
  if (!response.ok) {
    saveSession(null);
    return null;
  }
  const renewed = (await response.json()) as AuthResponse;
  saveSession(renewed);
  return renewed;
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
  retryAfterRefresh = true,
): Promise<T> {
  const session = readSession();
  const headers = new Headers(init.headers);
  if (
    !(init.body instanceof FormData) &&
    init.body &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }
  if (session?.accessToken)
    headers.set("Authorization", `Bearer ${session.accessToken}`);

  const response = await fetch(apiUrl(path), { ...init, headers });
  if (response.status === 401 && retryAfterRefresh && session?.refreshToken) {
    const renewed = await refreshSession();
    if (renewed) return apiRequest<T>(path, init, false);
  }
  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  const payload = await response.text();
  if (!payload.trim()) return null as T;
  try {
    return JSON.parse(payload) as T;
  } catch {
    throw new ApiError(
      response.status,
      "Le serveur a renvoyé une réponse illisible.",
      { path, contentType: response.headers.get("content-type") },
    );
  }
}

export async function downloadApiFile(path: string, filename: string) {
  const blob = await fetchApiFile(path);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function fetchApiFile(path: string): Promise<Blob> {
  const fetchFile = async (retryAfterRefresh = true): Promise<Response> => {
    const session = readSession();
    const headers = new Headers();
    if (session?.accessToken)
      headers.set("Authorization", `Bearer ${session.accessToken}`);
    const response = await fetch(apiUrl(path), { headers });
    if (response.status === 401 && retryAfterRefresh && session?.refreshToken) {
      const renewed = await refreshSession();
      if (renewed) return fetchFile(false);
    }
    if (!response.ok) throw await parseError(response);
    return response;
  };

  const response = await fetchFile();
  return response.blob();
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "PUT",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  delete: <T>(path: string) => apiRequest<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, body: FormData) =>
    apiRequest<T>(path, { method: "POST", body }),
};
