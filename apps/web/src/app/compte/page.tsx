import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountScreen } from "@/account/account-screen";

export const metadata: Metadata = { title: "Compte · Leximon" };

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountScreen />
    </Suspense>
  );
}
