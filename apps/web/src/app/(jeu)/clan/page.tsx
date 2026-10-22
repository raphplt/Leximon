import type { Metadata } from "next";
import { Suspense } from "react";
import { ClanScreen } from "@/clan/clan-screen";
import { FeatureGate } from "@/levels/feature-gate";

export const metadata: Metadata = { title: "Clan · Leximon" };

export default function ClanRoute() {
  return (
    <FeatureGate feature="join_clan" icon="clan">
      <Suspense fallback={null}>
        <ClanScreen />
      </Suspense>
    </FeatureGate>
  );
}
