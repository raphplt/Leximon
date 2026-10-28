import { Suspense } from "react";
import { MeasuresScreen } from "@/admin/measures-screen";

export default function AdminMeasuresPage() {
  // The period is read from the address: a client-side read, suspended at build time.
  return (
    <Suspense>
      <MeasuresScreen />
    </Suspense>
  );
}
