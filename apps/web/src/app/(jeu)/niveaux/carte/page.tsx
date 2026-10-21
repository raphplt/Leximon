import type { Metadata } from "next";
import { CardChoiceScreen } from "@/levels/card-choice-screen";

export const metadata: Metadata = { title: "Carte au choix · Leximon" };

export default function CardChoicePage() {
  return <CardChoiceScreen />;
}
