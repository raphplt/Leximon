import type { Metadata } from "next";
import { FindScreen } from "@/beta/find-screen";

export const metadata: Metadata = { title: "Dénicher un mot · Leximon" };

export default function FindPage() {
  return <FindScreen />;
}
