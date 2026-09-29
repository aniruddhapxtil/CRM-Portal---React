// SSO endpoints live at /auth/* (not /api/*): FastAPI serves them, and the Vite dev server proxies them.
export interface AuthUser {
  uid: number;
  email: string;
  role: string;
  name: string;
  mode: "demo" | "microsoft";
}

/** Returns the signed-in user, or null when nobody is signed in (or the session expired). */
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch("/auth/me");
  if (res.status === 401) return null;
  const isJson = res.headers.get("content-type")?.includes("application/json");
  if (!res.ok || !isJson) {
    throw new Error("Could not reach the CRM server to check your sign-in.");
  }
  return res.json();
}

/** Clears the session cookie on the server, then lands on the login page. */
export function signOut(): void {
  window.location.assign("/auth/logout");
}
