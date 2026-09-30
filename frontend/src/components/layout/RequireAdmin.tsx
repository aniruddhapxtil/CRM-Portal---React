import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";

/** Client-side convenience gate for Admin-only pages — the real enforcement is
 * server-side (every /api/user* and /api/users/* route requires the Admin role). */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const user = useAuth();
  if (user.role !== "Admin") return <Navigate to="/voice" replace />;
  return <>{children}</>;
}
