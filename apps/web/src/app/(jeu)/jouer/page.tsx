import type { Metadata } from "next";
import { BoosterScreen } from "@/booster/booster-screen";

export const metadata: Metadata = { title: "Jouer · Leximon" };

export default function PlayPage() {
  return <BoosterScreen />;
}
