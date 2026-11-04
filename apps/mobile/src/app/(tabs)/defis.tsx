import { useLocalSearchParams } from "expo-router";
import { ChallengeScreen } from "@/screens/challenges/challenge-screen";

export default function ChallengesRoute() {
  const { mot, revision } = useLocalSearchParams<{
    mot?: string;
    revision?: string;
  }>();
  return <ChallengeScreen word={mot ?? null} fromAlbum={revision !== undefined} />;
}
