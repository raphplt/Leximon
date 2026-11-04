import type { Metadata } from "next";
import { readShowcase } from "@/landing/showcase-server";
import { AccueilPlate } from "@/planches/accueil-plate";

export const metadata: Metadata = {
  title: "Planche Accueil · Leximon",
  robots: { index: false, follow: false },
};

export default async function AccueilPlatePage() {
  return <AccueilPlate showcase={await readShowcase()} />;
}
