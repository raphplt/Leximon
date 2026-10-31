import { type ReactNode, Suspense } from "react";
import { CommunityNav } from "@/community/community-nav";

/** The clan, the friends and the lists share one tab, and the row that goes from one to another. */
export default function CommunityLayout({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <CommunityNav />
      </Suspense>
      {children}
    </>
  );
}
