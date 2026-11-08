import type { Metadata } from "next";
import { MecenePlate } from "@/planches/mecene-plate";

export const metadata: Metadata = {
  title: "Planche Mécène · Leximon",
  robots: { index: false, follow: false },
};

export default function MecenePlatePage() {
  return <MecenePlate />;
}
