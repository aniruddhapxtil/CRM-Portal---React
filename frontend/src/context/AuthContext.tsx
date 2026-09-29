import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { fetchCurrentUser, type AuthUser } from "../api/auth";
import { redirectToLogin } from "../api/client";
import { Button } from "../components/ui/Button";

const AuthContext = createContext<AuthUser | null>(null);

function FullScreenMessage({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 bg-canvas px-6 text-center">
      {children}
    </div>
  );
}

/**
 * Asks the server "who is signed in?" once on load. Nothing of the CRM is drawn until the answer is yes;
 * a "no" sends the browser to /login. This is only for a smooth experience: the real security check
 * happens in the backend on every /api call.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchCurrentUser()
      .then((u) => {
        if (cancelled) return;
        if (u) setUser(u);
        else redirectToLogin();
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => {
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  if (error) {
    return (
      <FullScreenMessage>
        <p className="max-w-sm text-sm font-semibold text-danger">{error}</p>
        <Button onClick={retry}>Try again</Button>
      </FullScreenMessage>
    );
  }
  if (!user) {
    return (
      <FullScreenMessage>
        <p className="text-sm font-semibold text-muted">Checking your sign-in…</p>
      </FullScreenMessage>
    );
  }
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthUser {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
