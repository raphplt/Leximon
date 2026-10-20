import type { Metadata } from "next";
import { ChallengeScreen } from "@/challenges/challenge-screen";

export const metadata: Metadata = { title: "Défis · Leximon" };

export default function ChallengesPage() {
  return <ChallengeScreen />;
}
