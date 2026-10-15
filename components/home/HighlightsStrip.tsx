const HIGHLIGHTS = [
  "Rated 4.8 by 1,240 guests",
  "Airport pickup on request",
  "Breakfast 06:30 – 10:30",
  "Late checkout until 14:00",
  "Butler service in Presidential suites",
];

/** Endless scrolling strip of hotel highlights */
export function HighlightsStrip() {
  const items = [...HIGHLIGHTS, ...HIGHLIGHTS];
  return (
    <div className="overflow-hidden bg-pine-deep py-5 text-on-pine" aria-label="Hotel highlights">
      <ul className="animate-marquee flex w-max gap-12">
        {items.map((h, i) => (
          <li key={i} aria-hidden={i >= HIGHLIGHTS.length} className="display flex items-center gap-12 text-[19px] whitespace-nowrap italic md:text-[24px]">
            {h}
            <span className="text-sm text-brass not-italic">✦</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
