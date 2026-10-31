import { COMMUNITY_TITLE } from "@leximon/view-model";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CommunityScreen } from "@/community/community-screen";

export const metadata: Metadata = { title: `${COMMUNITY_TITLE} · Leximon` };

export default function CommunityRoute() {
  return (
    <Suspense fallback={null}>
      <CommunityScreen />
    </Suspense>
  );
}
