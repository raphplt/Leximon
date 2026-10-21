import { Suspense } from "react";
import { PlayerFromAddress } from "@/admin/player-screen";

export default function AdminPlayerPage() {
  // The id is read from the address on the client: a value known only per request.
  return (
    <Suspense>
      <PlayerFromAddress />
    </Suspense>
  );
}
