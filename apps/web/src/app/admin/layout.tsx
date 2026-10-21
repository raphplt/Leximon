import type { Metadata } from "next";
import { AdminShell } from "@/admin/admin-shell";

export const metadata: Metadata = {
  title: "Administration · Leximon",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return <AdminShell>{children}</AdminShell>;
}
