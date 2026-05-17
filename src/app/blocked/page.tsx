"use client";
import { ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";

export default function BlockedPage() {
  const router = useRouter();

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--bg)" }}
    >
      <div className="w-full max-w-sm text-center">
        <div className="card p-10">
          <div className="flex justify-center mb-4">
            <div
              className="rounded-full p-4"
              style={{ background: "rgba(220, 38, 38, 0.08)" }}
            >
              <ShieldOff className="h-10 w-10" style={{ color: "#dc2626" }} />
            </div>
          </div>

          <h1 className="text-xl font-bold mb-2">Access Blocked</h1>
          <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
            You don't have permission to view this page. Contact your admin to request access.
          </p>

          <button
            className="btn btn-primary w-full"
            onClick={() => router.back()}
          >
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
