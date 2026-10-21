import type { Metadata } from "next";
import { AtelierScreen } from "@/profile/atelier-screen";

export const metadata: Metadata = { title: "Atelier · Leximon" };

export default function AtelierPage() {
  return <AtelierScreen />;
}
