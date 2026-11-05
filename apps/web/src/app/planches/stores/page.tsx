import type { Metadata } from "next";
import { readShowcase } from "@/landing/showcase-server";
import { type StoreFormat, StorePlate } from "@/planches/store-plate";

export const metadata: Metadata = {
  title: "Planche stores · Leximon",
  robots: { index: false, follow: false },
};

export default async function StorePlatePage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string }>;
}) {
  const { format } = await searchParams;
  const shown: StoreFormat = format === "header" || format === "poster" ? format : "play";
  return <StorePlate format={shown} showcase={await readShowcase()} />;
}
