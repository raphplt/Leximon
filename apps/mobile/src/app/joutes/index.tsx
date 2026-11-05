import { FeatureGate } from "@/levels/feature-gate";
import { JoustsScreen } from "@/screens/jousts/jousts-screen";

export default function Screen() {
  return (
    <FeatureGate feature="jousts" icon="joutes">
      <JoustsScreen />
    </FeatureGate>
  );
}
