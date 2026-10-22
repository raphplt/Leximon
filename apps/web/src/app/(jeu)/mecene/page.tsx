import type { Metadata } from "next";
import { PatronScreen } from "@/beta/patron-screen";

export const metadata: Metadata = { title: "Mécène · Leximon" };

export default function PatronPage() {
  return <PatronScreen />;
}
