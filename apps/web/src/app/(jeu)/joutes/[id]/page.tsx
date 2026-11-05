import type { Metadata } from "next";
import { JoustScreen } from "@/jousts/joust-screen";
import { FeatureGate } from "@/levels/feature-gate";

export const metadata: Metadata = { title: "Joute · Leximon" };

export default async function JoustPage({ params }: PageProps<"/joutes/[id]">) {
  const { id } = await params;
  return (
    <FeatureGate feature="jousts" icon="joutes">
      <JoustScreen key={id} joustId={id} />
    </FeatureGate>
  );
}
