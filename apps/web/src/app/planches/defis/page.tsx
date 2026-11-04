import type { Metadata } from "next";
import { DefisPlate } from "@/planches/defis-plate";

export const metadata: Metadata = {
  title: "Planche Défis · Leximon",
  robots: { index: false, follow: false },
};

export default function DefisPlatePage() {
  return <DefisPlate />;
}
