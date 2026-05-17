"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    const email = username.includes("@") ? username : `${username}@zad.local`;
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setErr("Invalid username or password"); return; }
    router.replace("/dashboard");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm p-6">
        <div className="mb-5 text-center">
          <div className="text-xl font-bold" style={{ color: "var(--brand)" }}>Zad Workspace</div>
          <div className="text-xs" style={{ color: "var(--muted)" }}>Sign in to continue</div>
        </div>

        <label className="label">Username</label>
        <input
          className="input mt-1 mb-3"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />

        <label className="label">Password</label>
        <div className="relative mt-1 mb-4">
          <input
            type={showPw ? "text" : "password"}
            className="input w-full pr-10"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPw(!showPw)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--muted)" }}
          >
            {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>

        {err && (
          <div className="mb-3 rounded-xl px-3 py-2 text-sm" style={{ background: "#FAA9A9", color: "#5a1414" }}>
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
