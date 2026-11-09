import type { Metadata } from "next";
import { OrnementsPlate } from "@/planches/ornements-plate";

export const metadata: Metadata = {
  title: "Planche Ornements · Leximon",
  robots: { index: false, follow: false },
};

export default function OrnementsPlatePage() {
  return <OrnementsPlate />;
}
