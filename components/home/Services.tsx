import { RoomImage } from "@/components/rooms/RoomImage";
import { SectionHeading } from "@/components/ui/bits";
import { Reveal, Stagger, StaggerItem } from "@/components/ui/motion";
import { images } from "@/images";

// Icon paths use pathLength=1 so they redraw on hover (see .svg-draw in styles/animations.css)
const SERVICES = [
  { title: "Restaurant & bar", body: "Local and continental menu, room service until midnight.", paths: ["M4 3v8a3 3 0 0 0 6 0V3", "M7 3v18", "M17 3c-2 2-3 5-3 8h3v10"] },
  { title: "Spa & pool", body: "Pool, sauna and massage rooms, 07:00 to 21:00.", paths: ["M2 17h20", "M5 17V9l7-4 7 4v8", "M9 17v-4h6v4"] },
  { title: "Airport pickup", body: "Add a driver at checkout. We track your flight.", paths: ["M3 13l2-6h14l2 6", "M3 13h18v5H3z", "M7 18v2M17 18v2"] },
  { title: "Same-day laundry", body: "Bag it before 10:00, it's back by 18:00.", paths: ["M5 3h14v18H5z", "M8 7h8", "M12 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"] },
  { title: "Fibre Wi-Fi", body: "Fast enough for video calls from every room.", paths: ["M2 9a15 15 0 0 1 20 0", "M5 13a10 10 0 0 1 14 0", "M8.5 16.5a5 5 0 0 1 7 0"] },
  { title: "Fitness room", body: "Open around the clock with your room key.", paths: ["M6 6v12M18 6v12", "M3 9v6M21 9v6", "M6 12h12"] },
];

export function Services() {
  return (
    <section id="services" className="container-x scroll-mt-20 pb-16 md:pb-24">
      <SectionHeading eyebrow="Services" title="Everything is downstairs" />
      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <Reveal className="grid grid-cols-2 grid-rows-[150px_150px] gap-3 md:grid-rows-[250px_250px]">
          {[
            { src: images.pool, alt: "Hotel pool at night", cls: "row-span-2" },
            { src: images.restaurant, alt: "Dinner at the restaurant", cls: "" },
            { src: images.spa, alt: "Massage at the spa", cls: "" },
          ].map(p => (
            <div key={p.alt} className={`relative overflow-hidden rounded-[var(--radius-card)] ${p.cls}`}>
              <RoomImage src={p.src} alt={p.alt} fill sizes="(min-width: 1024px) 30vw, 50vw" className="object-cover transition-transform duration-[1100ms] hover:scale-105" />
            </div>
          ))}
        </Reveal>
        <Stagger className="grid overflow-hidden rounded-[18px] border border-line bg-line sm:grid-cols-2" gap={0.06}>
          {SERVICES.map(s => (
            <StaggerItem key={s.title} className="group grid content-start gap-1.5 bg-surface p-6 transition-colors duration-300 hover:bg-brass-soft">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="var(--color-pine)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="svg-draw" aria-hidden="true">
                {s.paths.map(d => (
                  <path key={d} d={d} pathLength={1} />
                ))}
              </svg>
              <h4 className="text-base font-semibold">{s.title}</h4>
              <p className="text-[13.5px] text-muted">{s.body}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
}
