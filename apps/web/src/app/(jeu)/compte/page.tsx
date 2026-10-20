import type { Metadata } from "next";
import { AccountScreen } from "@/account/account-screen";

export const metadata: Metadata = { title: "Compte · Leximon" };

export default function AccountPage() {
  return <AccountScreen />;
}
