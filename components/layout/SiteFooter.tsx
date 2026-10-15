import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { HOTEL } from "@/lib/constants";

const COLUMNS = [
  { title: "Stay", links: [["Rooms", "/rooms"], ["Services", "/#services"], ["Gallery", "/#gallery"]] },
  { title: "Guests", links: [["Sign in", "/auth/login"], ["Create account", "/auth/register"], ["My bookings", "/dashboard/bookings"]] },
  { title: "Team", links: [["Staff login", "/staff/login"], ["Admin login", "/admin/login"]] },
];

export function SiteFooter() {
  return (
    <footer id="contact" className="container-x grid grid-cols-2 gap-8 pt-14 pb-10 text-sm text-muted md:grid-cols-[2fr_1fr_1fr_1fr]">
      <div className="col-span-2 grid content-start gap-3 md:col-span-1">
        <Logo />
        <p className="max-w-[30ch]">{HOTEL.address}</p>
        <p className="num select-all text-ink">{HOTEL.phone}</p>
        <p>
          Check-in from <span className="num">{HOTEL.checkInTime}</span> · Check-out by <span className="num">{HOTEL.checkOutTime}</span>
        </p>
      </div>
      {COLUMNS.map(c => (
        <div key={c.title}>
          <h5 className="mb-2 text-[13px] font-semibold text-ink">{c.title}</h5>
          <ul className="grid gap-1.5">
            {c.links.map(([label, href]) => (
              <li key={href}>
                <Link href={href!} className="hover:text-ink">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="col-span-2 border-t border-line pt-6 text-xs md:col-span-4">© Keepr Hotels. All prices in Nigerian naira and include 7.5% VAT at checkout.</p>
    </footer>
  );
}
