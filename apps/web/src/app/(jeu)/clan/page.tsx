import type { Metadata } from "next";
import { FeatureGate } from "@/levels/feature-gate";

export const metadata: Metadata = { title: "Clan · Leximon" };

export default function ClanPage() {
  return <FeatureGate feature="join_clan" icon="clan" />;
}
