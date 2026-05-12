"use client";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar({ title }: { title: string }) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between border-b px-5 py-3"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <h1 className="text-base font-semibold">{title}</h1>
      <div className="flex items-center gap-2">
        <ThemeToggle />
      </div>
    </header>
  );
}
