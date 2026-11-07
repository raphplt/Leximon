import type { Metadata } from "next";
import { LeagueScreen } from "@/jousts/league-screen";
import { FeatureGate } from "@/levels/feature-gate";

export const metadata: Metadata = { title: "Classement des joutes · Leximon" };

export default function LeaguePage() {
  return (
    <FeatureGate feature="jousts" icon="joutes">
      <LeagueScreen />
    </FeatureGate>
  );
}
