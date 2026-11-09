import type { Metadata } from "next";
import { CrestsPlate } from "@/planches/crests-plate";

export const metadata: Metadata = {
  title: "Planche Blasons · Leximon",
  robots: { index: false, follow: false },
};

export default function BlasonsPlatePage() {
  return <CrestsPlate />;
}
