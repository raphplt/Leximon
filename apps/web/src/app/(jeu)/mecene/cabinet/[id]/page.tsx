import type { Metadata } from "next";
import { CabinetScreen } from "@/cabinet/cabinet-screen";

export const metadata: Metadata = { title: "Cabinet du mot · Leximon", robots: { index: false } };

export default async function CabinetPage({ params }: PageProps<"/mecene/cabinet/[id]">) {
  return <CabinetScreen cardId={(await params).id} />;
}
