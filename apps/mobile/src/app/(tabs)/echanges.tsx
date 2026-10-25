import { useLocalSearchParams } from "expo-router";
import { FeatureGate } from "@/levels/feature-gate";
import { TradesScreen } from "@/screens/trades/trades-screen";

export default function Screen() {
  // `donne`: a card offered from its sheet; `avec`: a player's code, from their profile.
  const { donne, avec } = useLocalSearchParams<{ donne?: string; avec?: string }>();
  return (
    <FeatureGate feature="trade" icon="echange">
      <TradesScreen given={donne ?? null} partner={avec ?? null} />
    </FeatureGate>
  );
}
