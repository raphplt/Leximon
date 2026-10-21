import { Suspense } from "react";
import { CardsScreen } from "@/admin/cards-screen";

export default function AdminCardsPage() {
  return (
    <Suspense fallback={null}>
      <CardsScreen />
    </Suspense>
  );
}
