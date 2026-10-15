import Link from "next/link";
import { PublicShell } from "@/components/layout/PublicShell";

export default function NotFound() {
  return (
    <PublicShell>
      <section className="container-x grid justify-items-start gap-4 py-24">
        <div className="eyebrow">Error 404</div>
        <h1 className="display text-[44px] md:text-[64px]">This door doesn&rsquo;t open.</h1>
        <p className="max-w-[48ch] text-muted">The page you&rsquo;re looking for has moved or never existed.</p>
        <div className="flex gap-3">
          <Link href="/" className="btn">Back to home</Link>
          <Link href="/rooms" className="btn btn-ghost">Browse rooms</Link>
        </div>
      </section>
    </PublicShell>
  );
}
