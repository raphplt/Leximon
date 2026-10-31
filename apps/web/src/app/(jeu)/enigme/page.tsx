import type { Metadata } from "next";
import { RiddleScreen } from "@/riddle/riddle-screen";

export const metadata: Metadata = { title: "Énigme du jour · Leximon" };

export default function RiddlePage() {
  return <RiddleScreen />;
}
