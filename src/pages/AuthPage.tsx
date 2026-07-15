import { useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase/client";
import { useAuth } from "../lib/auth/AuthProvider";
import { Button, Card, Field, Input } from "../components/ui/primitives";

type Mode = "signin" | "signup" | "reset";

export default function AuthPage() {
  const { user, configured, loading } = useAuth();
  const [mode, setMode] = useState<Mode>(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("signup") ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/overview" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    if (!supabase) {
      setErr("Supabase is not connected yet.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          // Return the verify link to the app on whatever origin the user signed
          // up from (e.g. https://commerly.io/auth), so confirmation lands in-app.
          options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/auth` },
        });
        if (error) throw error;
        setMsg("Check your email to verify your account, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth`,
        });
        if (error) throw error;
        setMsg("Password reset email sent.");
        setMode("signin");
      }
    } catch (e: any) {
      setErr(e.message ?? "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <Card className="w-full max-w-sm">
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-50">Commerly</h1>
        <p className="mb-4 text-sm text-slate-500">
          {mode === "signin" ? "Sign in" : mode === "signup" ? "Create your account" : "Reset password"}
        </p>

        {!configured && (
          <div className="mb-4 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
            Supabase not connected — auth is disabled until env is set.
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          {mode === "signup" && (
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </Field>
          )}
          <Field label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>
          {mode !== "reset" && (
            <Field label="Password">
              <Input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            </Field>
          )}

          {err && <p className="text-sm text-red-600">{err}</p>}
          {msg && <p className="text-sm text-emerald-600">{msg}</p>}

          <Button type="submit" disabled={busy || !configured} className="w-full">
            {busy ? "…" : mode === "signin" ? "Sign in" : mode === "signup" ? "Sign up" : "Send reset link"}
          </Button>
        </form>

        <div className="mt-4 flex justify-between text-xs text-slate-500">
          {mode !== "signin" ? (
            <button className="hover:underline" onClick={() => setMode("signin")}>Have an account? Sign in</button>
          ) : (
            <button className="hover:underline" onClick={() => setMode("signup")}>Create account</button>
          )}
          {mode !== "reset" && (
            <button className="hover:underline" onClick={() => setMode("reset")}>Forgot password?</button>
          )}
        </div>
      </Card>
    </div>
  );
}
