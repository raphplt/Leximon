import { useLocalSearchParams } from "expo-router";
import { LevelRoadScreen } from "@/screens/levels/level-road-screen";

export default function LevelRoadRoute() {
  // `niveau`: the level to show first, from the next rewards or the mail.
  const { niveau } = useLocalSearchParams<{ niveau?: string }>();
  const asked = niveau === undefined ? Number.NaN : Number(niveau);
  return <LevelRoadScreen asked={Number.isInteger(asked) && asked > 0 ? asked : null} />;
}
