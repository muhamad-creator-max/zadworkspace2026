import { Topbar } from "./Topbar";

export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <>
      <Topbar title={title} />
      <div className="p-5">
        <div className="card p-10 text-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {note ?? "This module will be built in the next phase."}
          </p>
        </div>
      </div>
    </>
  );
}
