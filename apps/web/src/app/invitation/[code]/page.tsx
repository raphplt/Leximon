import type { Metadata } from "next";
import { Suspense } from "react";
import { InvitationScreen } from "@/beta/invitation-screen";

export const metadata: Metadata = {
  title: "Invitation · Leximon",
  robots: { index: false, follow: false },
  // The code is in the address: it never leaves in a Referer header.
  referrer: "no-referrer",
};

export default function InvitationPage() {
  // The code is read from the address on the client: a value known only per request.
  return (
    <Suspense>
      <InvitationScreen />
    </Suspense>
  );
}
