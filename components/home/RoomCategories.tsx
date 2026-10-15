import { CategoryCard } from "@/components/rooms/CategoryCard";
import { SectionHeading } from "@/components/ui/bits";
import { Stagger, StaggerItem } from "@/components/ui/motion";
import { CATEGORY_LIST } from "@/lib/constants";

export function RoomCategories() {
  return (
    <section id="rooms" className="container-x scroll-mt-20 py-16 md:py-24">
      <SectionHeading
        eyebrow="Rooms"
        title="Three ways to stay"
        aside={<p className="max-w-[46ch] text-muted">Every room has fibre Wi-Fi, blackout curtains and daily housekeeping. The difference is space and the extras.</p>}
      />
      <Stagger className="grid gap-5 md:grid-cols-3">
        {CATEGORY_LIST.map(c => (
          <StaggerItem key={c.key}>
            <CategoryCard category={c.key} />
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
