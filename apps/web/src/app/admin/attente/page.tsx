import { redirect } from "next/navigation";

export default function AdminWaitlistPage() {
  redirect("/admin/invitations?onglet=attente");
}
