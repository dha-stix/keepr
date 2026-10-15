import { BookingCTA } from "@/components/home/BookingCTA";
import { Gallery } from "@/components/home/Gallery";
import { Hero } from "@/components/home/Hero";
import { HighlightsStrip } from "@/components/home/HighlightsStrip";
import { HowItWorks } from "@/components/home/HowItWorks";
import { RoomCategories } from "@/components/home/RoomCategories";
import { Services } from "@/components/home/Services";
import { PublicShell } from "@/components/layout/PublicShell";

export default function HomePage() {
  return (
    <PublicShell>
      <Hero />
      <HighlightsStrip />
      <RoomCategories />
      <Services />
      <HowItWorks />
      <Gallery />
      <BookingCTA />
    </PublicShell>
  );
}
