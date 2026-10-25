import { useLocalSearchParams } from "expo-router";
import { FeatureGate } from "@/levels/feature-gate";
import { ClanScreen } from "@/screens/clan/clan-screen";

export default function Screen() {
  // `code`: an invitation link to a clan.
  const { code } = useLocalSearchParams<{ code?: string }>();
  return (
    <FeatureGate feature="join_clan" icon="clan">
      <ClanScreen code={code ?? null} />
    </FeatureGate>
  );
}
