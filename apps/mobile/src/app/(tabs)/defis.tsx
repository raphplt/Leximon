import { useLocalSearchParams } from "expo-router";
import { ChallengeScreen } from "@/screens/challenges/challenge-screen";

export default function ChallengesRoute() {
  // `mot`: a word slipping away, picked in the mail, to review at once. `revision`: a filter of
  // the album, to review at once.
  const { mot, revision } = useLocalSearchParams<{ mot?: string; revision?: string }>();
  return <ChallengeScreen word={mot ?? null} fromAlbum={revision !== undefined} />;
}
