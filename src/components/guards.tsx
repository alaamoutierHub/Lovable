// Route/permission guards. UI-level only — the database RLS is the real authority.
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth/AuthProvider";
import { can, type Permission } from "../lib/auth/permissions";
import { Card } from "./ui/primitives";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { loading, configured, user } = useAuth();
  if (loading) return <FullPage>Loading…</FullPage>;
  if (!configured) {
    return (
      <FullPage>
        <Card className="max-w-md">
          <h2 className="text-lg font-semibold">Supabase not connected</h2>
          <p className="mt-2 text-sm text-slate-500">
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> (Lovable wires
            these when you connect Supabase). Auth and data are disabled until then.
          </p>
        </Card>
      </FullPage>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

export function RequirePermission({
  permission,
  children,
  fallback,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { role } = useAuth();
  if (!can(role, permission)) {
    return (
      <>{fallback ?? (
        <Card className="max-w-md">
          <h2 className="text-lg font-semibold">Not permitted</h2>
          <p className="mt-2 text-sm text-slate-500">
            Your role ({role ?? "none"}) cannot perform this action. Contact an admin.
          </p>
        </Card>
      )}</>
    );
  }
  return <>{children}</>;
}

/** Convenience: render children only when the role has the permission (no fallback UI). */
export function Can({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { role } = useAuth();
  return can(role, permission) ? <>{children}</> : null;
}

function FullPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 dark:bg-slate-950">
      {children}
    </div>
  );
}
