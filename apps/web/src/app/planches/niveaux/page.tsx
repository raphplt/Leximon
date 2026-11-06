import type { Metadata } from "next";
import { NiveauxPlate } from "@/planches/niveaux-plate";

export const metadata: Metadata = {
  title: "Planche Niveaux · Leximon",
  robots: { index: false, follow: false },
};

export default function NiveauxPlatePage() {
  return <NiveauxPlate />;
}
