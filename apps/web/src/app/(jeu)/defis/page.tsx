import type { Metadata } from "next";
import { Suspense } from "react";
import { ChallengeScreen } from "@/challenges/challenge-screen";

export const metadata: Metadata = { title: "Défis · Leximon" };

export default function ChallengesPage() {
  return (
    <Suspense fallback={null}>
      <ChallengeScreen />
    </Suspense>
  );
}
