import { CATEGORIES, HOTEL, VAT_RATE } from "./constants";
import type { Booking } from "./types";
import { formatDate, formatDateTime, naira, rateOf } from "./utils";

/** Downloads a self-contained HTML receipt for a paid booking (opens and prints cleanly in any browser) */
export function downloadReceipt(b: Booking) {
  const rows: [string, string][] = [
    [`${CATEGORIES[b.category].name} room ${b.roomNumber} · ${naira(rateOf(b))} × ${b.nights} night${b.nights > 1 ? "s" : ""}`, naira(b.subtotal)],
    ...(b.extras ? ([["Airport pickup", naira(b.extras)]] as [string, string][]) : []),
    [`VAT (${VAT_RATE * 100}%)`, naira(b.vat)],
  ];
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Keepr receipt ${esc(b.code)}</title>
<style>body{font:15px/1.5 system-ui,sans-serif;color:#12241f;max-width:640px;margin:40px auto;padding:0 20px}h1{font:500 32px Georgia,serif;margin:0}
.muted{color:#5b6b65}table{width:100%;border-collapse:collapse;margin:24px 0}td{padding:10px 0;border-bottom:1px solid #d5dbd4}td:last-child{text-align:right;font-family:ui-monospace,monospace}
tr.total td{font-weight:700;border-bottom:0;border-top:2px solid #12241f}.code{font-family:ui-monospace,monospace;letter-spacing:.1em}</style></head><body>
<h1>Keepr</h1><p class="muted">${esc(HOTEL.address)} · ${esc(HOTEL.phone)}</p>
<h2>Receipt</h2>
<p><b>Booking</b> <span class="code">${esc(b.code)}</span><br><b>Guest</b> ${esc(b.guestName)} (${esc(b.guestEmail)})<br>
<b>Stay</b> ${formatDate(b.checkIn, { weekday: "short", day: "numeric", month: "short", year: "numeric" })} – ${formatDate(b.checkOut, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}<br>
<b>Paid</b> ${b.paidAt ? formatDateTime(b.paidAt) : "Not paid"} via Bachs${b.paymentRef ? ` · ref <span class="code">${esc(b.paymentRef)}</span>` : ""}</p>
<table>${rows.map(([l, v]) => `<tr><td>${esc(l)}</td><td>${v}</td></tr>`).join("")}<tr class="total"><td>Total paid</td><td>${naira(b.total)}</td></tr></table>
<p class="muted">Thank you for staying with Keepr.</p></body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: `keepr-receipt-${b.code}.html` });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
