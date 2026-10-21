import { Suspense } from "react";
import { PlayersScreen } from "@/admin/players-screen";

export default function AdminPlayersPage() {
  // The list reads its filters from the address: a client-side read, suspended at build time.
  return (
    <Suspense>
      <PlayersScreen />
    </Suspense>
  );
}
