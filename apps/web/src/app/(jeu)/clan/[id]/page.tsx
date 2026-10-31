import type { Metadata } from "next";
import { ClanVisitScreen } from "@/clan/clan-visit";

export const metadata: Metadata = { title: "Clan · Leximon" };

/** Open at every level: only joining a clan waits for its level. */
export default async function ClanVisitRoute({ params }: PageProps<"/clan/[id]">) {
  const { id } = await params;
  return <ClanVisitScreen key={id} clanId={id} />;
}
