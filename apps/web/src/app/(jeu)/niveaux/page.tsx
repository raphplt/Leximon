import type { Metadata } from "next";
import { LevelRoadScreen } from "@/levels/level-road-screen";

export const metadata: Metadata = { title: "Chemin des niveaux · Leximon" };

export default function LevelsPage() {
  return <LevelRoadScreen />;
}
