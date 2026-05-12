"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    // Map username "admin" -> admin email; allow any other treated as email directly.
    const email = username.includes("@") ? username : `${username}@zad.local`;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setErr("Invalid username or password");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <div className="text-xl font-bold" style={{ color: "var(--brand)" }}>
            Zad Workspace
          </div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            Sign in to continue
          </div>
        </div>

        <label className="label">Username</label>
        <input
          className="input mt-1 mb-3"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />

        <label className="label">Password</label>
        <input
          type="password"
          className="input mt-1 mb-4"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {err && (
          <div
            className="mb-3 rounded-xl px-3 py-2 text-sm"
            style={{ background: "#FAA9A9", color: "#5a1414" }}
          >
            {err}
          </div>
        )}

        <button className="btn btn-primary w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="mt-4 text-center text-xs">
          <span style={{ color: "var(--muted)" }}>Don't have access? </span>
          <a href="/access-request" className="underline font-medium" style={{ color: "var(--brand)" }}>
            Request access
          </a>
        </p>
      </form>
    </div>
  );
}
