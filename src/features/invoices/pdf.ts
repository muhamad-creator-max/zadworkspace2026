"use client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Invoice } from "@/lib/types";
import { money, dt } from "@/lib/format";

export function downloadInvoicePDF(inv: Invoice) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Brand header bar
  doc.setFillColor(53, 74, 55);
  doc.rect(0, 0, pageW, 70, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("Zad Workspace", 40, 35);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Coworking management", 40, 52);

  doc.setFontSize(11);
  doc.text(`Invoice #${inv.id.slice(0, 8).toUpperCase()}`, pageW - 40, 35, { align: "right" });
  doc.text(dt(inv.issued_at), pageW - 40, 52, { align: "right" });

  // Meta
  doc.setTextColor(20, 20, 20);
  doc.setFontSize(11);
  doc.text(`Customer: ${inv.customer_name ?? "—"}`, 40, 100);
  doc.text(`Type: ${inv.kind === "session" ? "Session" : "Subscription"}`, 40, 116);
  doc.text(`Payment: ${inv.payment_method}`, 40, 132);
  doc.text(`Staff: ${inv.created_by}`, 40, 148);

  // Items table
  autoTable(doc, {
    startY: 175,
    head: [["Item", "Qty", "Unit", "Total"]],
    body: inv.items.map((i) => [i.name, String(i.qty), money(i.price), money(i.total)]),
    styles: { fontSize: 10, cellPadding: 8 },
    headStyles: { fillColor: [53, 74, 55], textColor: 255 },
    columnStyles: {
      1: { halign: "right" },
      2: { halign: "right" },
      3: { halign: "right" },
    },
    margin: { left: 40, right: 40 },
  });

  const endY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(11);
  doc.text(`Session: ${money(inv.session_amount)}`, pageW - 40, endY, { align: "right" });
  doc.text(`Orders: ${money(inv.orders_amount)}`, pageW - 40, endY + 16, { align: "right" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(`Total: ${money(inv.total_amount)}`, pageW - 40, endY + 38, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text("Thank you for choosing Zad Workspace.", 40, doc.internal.pageSize.getHeight() - 30);

  doc.save(`Zad-Invoice-${inv.id.slice(0, 8)}.pdf`);
}
