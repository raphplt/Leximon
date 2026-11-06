import type { Metadata } from "next";
import { JoutesPlate } from "@/planches/joutes-plate";

export const metadata: Metadata = {
  title: "Planche Joutes · Leximon",
  robots: { index: false, follow: false },
};

export default function JoutesPlatePage() {
  return <JoutesPlate />;
}
