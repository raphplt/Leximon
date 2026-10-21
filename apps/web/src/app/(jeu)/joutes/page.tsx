import type { Metadata } from "next";
import { FeatureGate } from "@/levels/feature-gate";

export const metadata: Metadata = { title: "Joutes · Leximon" };

export default function JoustsPage() {
  return <FeatureGate feature="jousts" icon="joutes" />;
}
