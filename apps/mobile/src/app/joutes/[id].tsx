import { useLocalSearchParams } from "expo-router";
import { FeatureGate } from "@/levels/feature-gate";
import { JoustScreen } from "@/screens/jousts/joust-screen";

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <FeatureGate feature="jousts" icon="joutes">
      <JoustScreen key={id} joustId={id} />
    </FeatureGate>
  );
}
