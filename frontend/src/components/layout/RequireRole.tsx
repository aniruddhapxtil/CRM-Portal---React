import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/** Client-side convenience gate for role-restricted pages/routes — the real enforcement is
 * always server-side (each protected endpoint carries its own require_role() dependency). */
export function RequireRole({ allowed, children }: { allowed: string[]; children: ReactNode }) {
  const user = useAuth();
  if (!allowed.includes(user.role)) return <Navigate to="/voice" replace />;
  return <>{children}</>;
}
