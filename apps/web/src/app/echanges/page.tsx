import type { Metadata } from "next";
import { TradesScreen } from "@/trades/trades-screen";

export const metadata: Metadata = { title: "Échanges · Leximon" };

export default function TradesPage() {
  return <TradesScreen />;
}
