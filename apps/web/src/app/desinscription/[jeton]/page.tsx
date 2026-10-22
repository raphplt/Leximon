import type { Metadata } from "next";
import { Suspense } from "react";
import { UnsubscribeFromAddress } from "@/unsubscribe/unsubscribe-screen";

export const metadata: Metadata = {
  title: "Désinscription · Leximon",
  robots: { index: false, follow: false },
  // The token is in the address: it never leaves in a Referer header.
  referrer: "no-referrer",
};

export default function UnsubscribePage() {
  // The token is read from the address on the client: a value known only per request.
  return (
    <Suspense>
      <UnsubscribeFromAddress />
    </Suspense>
  );
}
