import type { Metadata } from "next";
import { Suspense } from "react";
import { FriendsScreen } from "@/friends/friends-screen";

export const metadata: Metadata = { title: "Amis · Leximon" };

export default function FriendsRoute() {
  return (
    <Suspense fallback={null}>
      <FriendsScreen />
    </Suspense>
  );
}
