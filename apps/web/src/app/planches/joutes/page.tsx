import type { Metadata } from "next";
import { LicePlate } from "@/planches/lice-plate";

export const metadata: Metadata = {
  title: "Planche Joutes · Leximon",
  robots: { index: false, follow: false },
};

export default function JoutesPlatePage() {
  return <LicePlate />;
}
