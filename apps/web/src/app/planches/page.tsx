import type { Metadata } from "next";
import { Planches } from "@/planches/planches";

export const metadata: Metadata = {
  title: "Planches · Leximon",
  robots: { index: false, follow: false },
};

export default function PlanchesPage() {
  return <Planches />;
}
