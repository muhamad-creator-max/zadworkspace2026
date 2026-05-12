"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft, Download, Printer } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useToast } from "@/components/ui/Toast";
import { getInvoice } from "@/features/checkout/api";
import { downloadInvoicePDF } from "@/features/invoices/pdf";
import type { Invoice } from "@/lib/types";
import { dt, money } from "@/lib/format";

export default function InvoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { push } = useToast();
  const [inv, setInv] = useState<Invoice | null>(null);

  useEffect(() => {
    getInvoice(params.id)
      .then(setInv)
      .catch((e) => push({ kind: "err", msg: e.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (!inv) {
    return (
      <>
        <Topbar title="Invoice" />
        <div className="p-5 text-sm" style={{ color: "var(--muted)" }}>Loading…</div>
      </>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          @page { margin: 14mm; }
          body { background: white !important; }
          .print-hide { display: none !important; }
          .invoice-paper { box-shadow: none !important; border: none !important; }
        }
      `}</style>
      <Topbar title="Invoice" />
      <div className="p-5">
        <div className="mb-4 flex items-center justify-between print-hide">
          <button
            className="inline-flex items-center gap-1 text-sm"
            style={{ color: "var(--muted)" }}
            onClick={() => router.back()}
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </button>
          <div className="flex gap-2">
            <button className="btn btn-ghost" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </button>
            <button className="btn btn-primary" onClick={() => downloadInvoicePDF(inv)}>
              <Download className="h-4 w-4" /> Download PDF
            </button>
          </div>
        </div>

        <div className="invoice-paper card mx-auto max-w-3xl overflow-hidden">
          <div
            className="px-8 py-6"
            style={{ background: "#354A37", color: "#fff" }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xl font-bold">Zad Workspace</div>
                <div className="text-xs opacity-80">Coworking management</div>
              </div>
              <div className="text-right">
                <div className="text-sm">Invoice #{inv.id.slice(0, 8).toUpperCase()}</div>
                <div className="text-xs opacity-80">{dt(inv.issued_at)}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 px-8 py-5">
            <Meta label="Customer" value={inv.customer_name ?? "—"} />
            <Meta label="Type" value={inv.kind === "session" ? "Session" : "Subscription"} />
            <Meta label="Payment method" value={inv.payment_method} />
            <Meta label="Staff" value={inv.created_by} />
          </div>

          <div className="border-t px-8 py-5" style={{ borderColor: "var(--border)" }}>
            <table className="table-zad">
              <thead>
                <tr>
                  <th>Item</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {inv.items.map((it, i) => (
                  <tr key={i}>
                    <td>{it.name}</td>
                    <td className="text-right">{it.qty}</td>
                    <td className="text-right">{money(it.price)}</td>
                    <td className="text-right font-medium">{money(it.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-5 ml-auto max-w-xs space-y-1.5 text-sm">
              <Row label="Session" value={money(inv.session_amount)} />
              <Row label="Orders" value={money(inv.orders_amount)} />
              <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
              <Row label="Total" value={money(inv.total_amount)} bold />
            </div>
          </div>

          <div
            className="px-8 py-4 text-center text-xs"
            style={{ color: "var(--muted)", borderTop: "1px solid var(--border)" }}
          >
            Thank you for choosing Zad Workspace.
          </div>
        </div>
      </div>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <span className={bold ? "text-base font-semibold" : ""}>{value}</span>
    </div>
  );
}
