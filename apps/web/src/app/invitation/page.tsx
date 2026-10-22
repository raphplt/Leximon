import type { Metadata } from "next";
import { InvitationRequiredScreen } from "@/beta/invitation-screen";

export const metadata: Metadata = {
  title: "Sur invitation · Leximon",
  robots: { index: false, follow: false },
};

export default function InvitationRequiredPage() {
  return <InvitationRequiredScreen />;
}
