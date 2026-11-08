import type { Metadata } from "next";
import { IconesPlate } from "@/planches/icones-plate";

export const metadata: Metadata = {
  title: "Planche Icônes · Leximon",
  robots: { index: false, follow: false },
};

export default function IconesPlatePage() {
  return <IconesPlate />;
}
