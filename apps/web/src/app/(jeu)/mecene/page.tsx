import type { Metadata } from "next";
import { Suspense } from "react";
import { PatronScreen } from "@/beta/patron-screen";

export const metadata: Metadata = { title: "Mécène · Leximon" };

export default function PatronPage() {
  return (
    <Suspense fallback={null}>
      <PatronScreen />
    </Suspense>
  );
}
