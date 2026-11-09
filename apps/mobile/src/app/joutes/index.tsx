import { FeatureGate } from "@/levels/feature-gate";
import { ChallengeHalves } from "@/screens/challenges/challenge-halves";
import { JoustsScreen } from "@/screens/jousts/jousts-screen";

export default function Screen() {
  return (
    <FeatureGate feature="jousts" icon="joutes" above={<ChallengeHalves current="jousts" />}>
      <JoustsScreen />
    </FeatureGate>
  );
}
