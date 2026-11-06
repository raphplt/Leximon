import type { Metadata } from "next";
import { ClanPlate } from "@/planches/clan-plate";

export const metadata: Metadata = {
  title: "Planche Clan · Leximon",
  robots: { index: false, follow: false },
};

export default function ClanPlatePage() {
  return <ClanPlate />;
}
