// Relative "/api" base: Vite dev-server proxies it to FastAPI (see vite.config.ts);
// in production FastAPI serves this same build, so it's same-origin there too.
const BASE_URL = "/api";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Sends the browser to the SSO login page (served by FastAPI at /login). */
export function redirectToLogin(): void {
  window.location.assign("/login");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  // Signed out or session expired: the backend checks this on every call; the page just follows along.
  if (res.status === 401) {
    redirectToLogin();
    throw new ApiError(401, "Your session has ended. Redirecting to sign-in…");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body?.detail ?? res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const apiGet = <T>(path: string) => request<T>(path);

export const apiPost = <T>(path: string, data: unknown) =>
  request<T>(path, { method: "POST", body: JSON.stringify(data) });
