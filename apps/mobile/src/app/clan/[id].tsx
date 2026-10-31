import { useLocalSearchParams } from "expo-router";
import { ClanVisitScreen } from "@/screens/clan/clan-visit";

/** Open at every level: only joining a clan waits for its level. */
export default function ClanVisitRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ClanVisitScreen key={id} clanId={id} />;
}
