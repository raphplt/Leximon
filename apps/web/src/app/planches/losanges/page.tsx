import type { Metadata } from "next";
import { LosangesPlate } from "@/planches/losanges-plate";

export const metadata: Metadata = {
  title: "Planche Losanges · Leximon",
  robots: { index: false, follow: false },
};

export default function LosangesPlatePage() {
  return <LosangesPlate />;
}
