import { FeatureGate } from "@/levels/feature-gate";
import { LeagueScreen } from "@/screens/jousts/league-screen";

export default function Screen() {
  return (
    <FeatureGate feature="jousts" icon="joutes">
      <LeagueScreen />
    </FeatureGate>
  );
}
