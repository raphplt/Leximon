import type { Metadata } from "next";
import { Suspense } from "react";
import { AlbumScreen } from "@/album/album-screen";

export const metadata: Metadata = { title: "Mon album · Leximon" };

export default function AlbumPage() {
  return (
    <Suspense fallback={null}>
      <AlbumScreen />
    </Suspense>
  );
}
