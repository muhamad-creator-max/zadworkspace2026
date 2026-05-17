"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, Phone, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { submitAccessRequestAction } from "@/features/staff/actions";

export default function AccessRequestPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const u = username.trim().toLowerCase();
    if (!u) { setError("Username is required"); return; }
    if (/\s/.test(u)) { setError("Username cannot contain spaces"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      const result = await submitAccessRequestAction({
        username: u,
        password,
        phone: phone.trim() || undefined,
      });
      if (result.error) { setError(result.error); return; }
      setSuccess(true);
      setTimeout(() => router.push("/login"), 2000);
    } catch (err: any) {
      setError(err.message || "Failed to submit request");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
        <div className="w-full max-w-md">
          <div className="card p-8 text-center">
            <div className="mb-4 flex justify-center">
              <CheckCircle className="h-16 w-16" style={{ color: "var(--brand-success)" }} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Request Submitted</h2>
            <p style={{ color: "var(--muted)" }} className="text-sm mb-4">
              Your request has been submitted. An admin will review it shortly.
              Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--bg)" }}>
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-bold mb-1">Request Access</h1>
          <p style={{ color: "var(--muted)" }} className="text-sm mb-6">
            Submit a request to join the Zad Workspace staff
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div
                className="flex items-start gap-3 rounded-lg p-3 text-sm"
                style={{ background: "rgba(250, 169, 169, 0.1)", color: "#8B0000" }}
              >
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="label">Username *</label>
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2 mt-1" style={{ borderColor: "var(--border)" }}>
                <User className="h-4 w-4" style={{ color: "var(--muted)" }} />
                <input
                  type="text"
                  className="flex-1 bg-transparent outline-none"
                  placeholder="e.g. john"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loading}
                  autoFocus
                />
              </div>
              <p style={{ color: "var(--muted)" }} className="text-xs mt-1">
                You will log in with this username
              </p>
            </div>

            <div>
              <label className="label">Phone (Optional)</label>
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2 mt-1" style={{ borderColor: "var(--border)" }}>
                <Phone className="h-4 w-4" style={{ color: "var(--muted)" }} />
                <input
                  type="tel"
                  className="flex-1 bg-transparent outline-none"
                  placeholder="+20 XXX XXXX XXX"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div>
              <label className="label">Password *</label>
              <div className="flex items-center gap-2 rounded-xl border px-3 py-2 mt-1" style={{ borderColor: "var(--border)" }}>
                <Lock className="h-4 w-4 shrink-0" style={{ color: "var(--muted)" }} />
                <input
                  type={showPw ? "text" : "password"}
                  className="flex-1 bg-transparent outline-none"
                  placeholder="At least 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ color: "var(--muted)" }}>
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p style={{ color: "var(--muted)" }} className="text-xs mt-1">
                Minimum 6 characters
              </p>
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full mt-6"
              disabled={loading}
            >
              {loading ? "Submitting…" : "Submit Request"}
            </button>

            <p style={{ color: "var(--muted)" }} className="text-xs text-center">
              Already have access?{" "}
              <a href="/login" className="underline hover:opacity-80">
                Sign in
              </a>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
