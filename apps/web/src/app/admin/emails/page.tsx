import { Suspense } from "react";
import { EmailsScreen } from "@/admin/emails-screen";

export default function AdminEmailsPage() {
  // The period is read from the address: a client-side read, suspended at build time.
  return (
    <Suspense>
      <EmailsScreen />
    </Suspense>
  );
}
