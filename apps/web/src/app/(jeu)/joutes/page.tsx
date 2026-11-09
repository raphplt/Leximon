import type { Metadata } from "next";
import { ChallengeHalves } from "@/challenges/challenge-halves";
import { JoustsScreen } from "@/jousts/jousts-screen";
import { FeatureGate } from "@/levels/feature-gate";

export const metadata: Metadata = { title: "Joutes · Leximon" };

export default function JoustsPage() {
  return (
    <FeatureGate feature="jousts" icon="joutes" above={<ChallengeHalves current="jousts" />}>
      <JoustsScreen />
    </FeatureGate>
  );
}
