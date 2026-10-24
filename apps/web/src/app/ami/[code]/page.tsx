import type { Metadata } from "next";
import { Suspense } from "react";
import { ReferrerScreen } from "@/friends/referrer-screen";

export const metadata: Metadata = {
  title: "Invitation · Leximon",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function FriendLinkPage() {
  // The code is read from the address on the client: a value known only per request.
  return (
    <Suspense>
      <ReferrerScreen />
    </Suspense>
  );
}
