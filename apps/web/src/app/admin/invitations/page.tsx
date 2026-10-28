import { Suspense } from "react";
import { InvitationsScreen } from "@/admin/invitations-screen";

export default function AdminInvitesPage() {
  // The tab is read from the address: a client-side read, suspended at build time.
  return (
    <Suspense>
      <InvitationsScreen />
    </Suspense>
  );
}
