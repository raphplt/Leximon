import { useLocalSearchParams } from "expo-router";
import { ChallengeScreen } from "@/screens/challenges/challenge-screen";

export default function ChallengesRoute() {
  // `mot`: a word slipping away, picked in the mail, to review at once.
  const { mot } = useLocalSearchParams<{ mot?: string }>();
  return <ChallengeScreen word={mot ?? null} />;
}
