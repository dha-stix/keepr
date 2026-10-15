"use client";

import { Download } from "lucide-react";
import { EmptyState } from "@/components/ui/bits";
import type { Payment } from "@/lib/types";
import { formatDateTime, naira } from "@/lib/utils";

export const METHOD_LABEL: Record<string, string> = {
  card: "Card",
  bank_transfer: "Bank transfer",
  mobile_money: "Mobile money",
  crypto: "Crypto",
  other: "Other",
};
export const methodLabel = (m?: string) => METHOD_LABEL[m ?? "other"] ?? m ?? "Other";

/** Payments list. Desk/admin view shows guest and who confirmed it at the desk, and can export CSV. */
export function PaymentsTable({ payments, variant, limit }: { payments: Payment[]; variant: "guest" | "desk"; limit?: number }) {
  const rows = payments.slice(0, limit);
  if (!rows.length) return <EmptyState title="No payments yet">Payments made through Bachs show up here.</EmptyState>;
  return (
    <div className="overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            <th>Reference</th>
            {variant === "desk" && <th>Guest</th>}
            <th>Booking</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Paid</th>
            <th>{variant === "desk" ? "Desk confirmed" : "Status"}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(p => (
            <tr key={p.id}>
              <td className="num">{p.reference}</td>
              {variant === "desk" && <td>{p.guestName}</td>}
              <td className="num">{p.bookingCode}</td>
              <td className="num">{naira(p.amount)}</td>
              <td>{methodLabel(p.method)}</td>
              <td className="num whitespace-nowrap">{formatDateTime(p.paidAt)}</td>
              <td>
                {p.status === "refunded" ? (
                  <span className="pill pill-mute">Refunded</span>
                ) : variant === "desk" ? (
                  p.confirmedBy ? <span className="pill pill-ok">{p.confirmedBy}</span> : <span className="pill pill-warn">Pending</span>
                ) : (
                  <span className="pill pill-ok">Paid</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Downloads payments as a CSV file */
export function ExportPaymentsButton({ payments, filename = "keepr-payments" }: { payments: Payment[]; filename?: string }) {
  const exportCsv = () => {
    const head = ["Reference", "Guest", "Booking", "Amount (NGN)", "Bachs fee (NGN)", "Settled (NGN)", "Method", "Paid at", "Confirmed by", "Status"];
    const lines = payments.map(p => [p.reference, p.guestName, p.bookingCode, p.amount, p.processingFee ?? "", p.settlementAmount ?? "", methodLabel(p.method), p.paidAt, p.confirmedBy ?? "", p.status].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const url = URL.createObjectURL(new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${filename}.csv` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <button className="btn btn-ghost btn-sm" onClick={exportCsv} disabled={!payments.length}>
      <Download className="h-3.5 w-3.5" /> Export CSV
    </button>
  );
}
