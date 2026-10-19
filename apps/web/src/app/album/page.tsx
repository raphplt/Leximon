import type { Metadata } from "next";
import { AlbumScreen } from "@/album/album-screen";

export const metadata: Metadata = { title: "Mon album · Leximon" };

export default function AlbumPage() {
  return <AlbumScreen />;
}
