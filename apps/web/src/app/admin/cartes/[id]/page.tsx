import { Suspense } from "react";
import { CardFromAddress } from "@/admin/card-screen";

export default function AdminCardPage() {
  // The id is read from the address on the client: a value known only per request.
  return (
    <Suspense>
      <CardFromAddress />
    </Suspense>
  );
}
