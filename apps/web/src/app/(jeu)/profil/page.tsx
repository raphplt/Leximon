import type { Metadata } from "next";
import { ProfileScreen } from "@/profile/profile-screen";

export const metadata: Metadata = { title: "Mon profil · Leximon" };

export default function ProfilePage() {
  return <ProfileScreen />;
}
