import { Suspense } from "react";
import { CampaignFromAddress } from "@/admin/campaign-screen";

export default function AdminCampaignPage() {
  // The id is read from the address on the client: a value known only per request.
  return (
    <Suspense>
      <CampaignFromAddress />
    </Suspense>
  );
}
