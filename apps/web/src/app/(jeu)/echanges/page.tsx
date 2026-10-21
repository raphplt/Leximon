import type { Metadata } from "next";
import { Suspense } from "react";
import { FeatureGate } from "@/levels/feature-gate";
import { TradesScreen } from "@/trades/trades-screen";

export const metadata: Metadata = { title: "Échanges · Leximon" };

export default function TradesPage() {
  return (
    <FeatureGate feature="trade" icon="echange">
      <Suspense fallback={null}>
        <TradesScreen />
      </Suspense>
    </FeatureGate>
  );
}
