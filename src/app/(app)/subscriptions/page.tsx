"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, IdCard } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { PlanFormModal } from "@/features/subscriptions/PlanFormModal";
import { SubscriberFormModal } from "@/features/subscriptions/SubscriberFormModal";
import {
  listPlans, listSubscribers, softDeletePlan, softDeleteSubscriber,
} from "@/features/subscriptions/api";
import type { Plan, Subscriber } from "@/lib/types";
import { dt, money } from "@/lib/format";

export default function SubscriptionsPage() {
  const router = useRouter();
  const { push } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subs, setSubs] = useState<Subscriber[]>([]);

  const [planAddOpen, setPlanAddOpen] = useState(false);
  const [planEdit, setPlanEdit] = useState<Plan | null>(null);
  const [planDelete, setPlanDelete] = useState<Plan | null>(null);

  const [subAddOpen, setSubAddOpen] = useState(false);
  const [subEdit, setSubEdit] = useState<Subscriber | null>(null);
  const [subDelete, setSubDelete] = useState<Subscriber | null>(null);

  const refresh = async () => {
    try {
      const [p, s] = await Promise.all([listPlans(), listSubscribers()]);
      setPlans(p);
      setSubs(s);
    } catch (e: any) {
      push({ kind: "err", msg: e.message });
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Topbar title="Subscriptions" />
      <div className="p-5 space-y-6">
        {/* PLANS */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: "var(--muted)" }}>
              Plans · {plans.length}
            </h2>
            <button className="btn btn-primary" onClick={() => setPlanAddOpen(true)}>
              <Plus className="h-4 w-4" /> New plan
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className="card overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ background: p.label_color, color: "#fff" }}
                >
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-sm font-bold">
                      {p.letter}
                    </span>
                    <span className="font-semibold">{p.name}</span>
                  </div>
                  <div className="flex gap-1">
                    <button
                      className="rounded-lg bg-white/15 p-1.5 hover:bg-white/25"
                      onClick={() => setPlanEdit(p)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="rounded-lg bg-white/15 p-1.5 hover:bg-white/25"
                      onClick={() => setPlanDelete(p)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  {p.description && (
                    <p className="mb-3 text-sm" style={{ color: "var(--muted)" }}>{p.description}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <Stat label="Hours" value={`${p.hours}h`} />
                    <Stat label="Price" value={money(Number(p.price))} />
                    <Stat label="Seats" value={String(p.available_seats)} />
                    <Stat label="Expires" value={`${p.expiration_days} days`} />
                  </div>
                </div>
              </div>
            ))}
            {!plans.length && (
              <div className="card col-span-full p-8 text-center text-sm"
                   style={{ color: "var(--muted)" }}>
                No plans yet. Create one to start adding subscribers.
              </div>
            )}
          </div>
        </section>

        {/* SUBSCRIBERS */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide"
                style={{ color: "var(--muted)" }}>
              Subscribers · {subs.length}
            </h2>
            <button
              className="btn btn-primary"
              onClick={() => setSubAddOpen(true)}
              disabled={!plans.length}
            >
              <IdCard className="h-4 w-4" /> New subscriber
            </button>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="table-zad">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Plan</th>
                    <th>Hours left</th>
                    <th>Expires</th>
                    <th>Payment</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subs.map((s) => {
                    const expired = new Date(s.expires_at) < new Date();
                    return (
                      <tr key={s.id}>
                        <td>
                          <span className="badge" style={{
                            background: s.plan?.label_color ?? "var(--brand)",
                            color: "#fff",
                          }}>{s.code}</span>
                        </td>
                        <td className="font-medium">{s.name}</td>
                        <td>{s.phone}</td>
                        <td>{s.plan?.name ?? "—"}</td>
                        <td>{Number(s.hours_remaining).toFixed(1)} / {s.total_hours}h</td>
                        <td>
                          {expired
                            ? <span className="badge" style={{ background: "#FAA9A9", color: "#5a1414" }}>Expired</span>
                            : new Date(s.expires_at).toLocaleDateString()}
                        </td>
                        <td>{s.payment_method}</td>
                        <td className="text-right">
                          <button className="btn btn-ghost !px-2 !py-1" onClick={() => setSubEdit(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button className="btn btn-ghost !px-2 !py-1 ml-1" onClick={() => setSubDelete(s)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {!subs.length && (
                    <tr>
                      <td colSpan={8} className="text-center"
                          style={{ color: "var(--muted)" }}>
                        No subscribers yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>

      {/* MODALS */}
      <PlanFormModal open={planAddOpen} onClose={() => setPlanAddOpen(false)} onSaved={refresh} />
      <PlanFormModal
        open={!!planEdit}
        onClose={() => setPlanEdit(null)}
        initial={planEdit}
        onSaved={refresh}
      />
      <ConfirmDialog
        open={!!planDelete}
        title="Remove plan?"
        message="The plan will be hidden but existing subscribers and their invoices stay intact."
        confirmLabel="Remove"
        destructive
        onCancel={() => setPlanDelete(null)}
        onConfirm={async () => {
          await softDeletePlan(planDelete!.id);
          setPlanDelete(null);
          refresh();
        }}
      />

      <SubscriberFormModal
        open={subAddOpen}
        onClose={() => setSubAddOpen(false)}
        onCreated={(_s, invoiceId) => {
          refresh();
          router.push(`/invoice/${invoiceId}`);
        }}
      />
      <SubscriberFormModal
        open={!!subEdit}
        onClose={() => setSubEdit(null)}
        initial={subEdit}
        onUpdated={refresh}
      />
      <ConfirmDialog
        open={!!subDelete}
        title="Remove subscriber?"
        message="The subscriber will be hidden but past sessions and invoices stay intact."
        confirmLabel="Remove"
        destructive
        onCancel={() => setSubDelete(null)}
        onConfirm={async () => {
          await softDeleteSubscriber(subDelete!.id);
          setSubDelete(null);
          refresh();
        }}
      />
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
