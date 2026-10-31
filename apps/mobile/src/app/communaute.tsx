import { communityTabOf } from "@leximon/view-model";
import { useLocalSearchParams } from "expo-router";
import { CommunityScreen } from "@/screens/community/community-screen";

export default function CommunityRoute() {
  const { onglet } = useLocalSearchParams<{ onglet?: string }>();
  return <CommunityScreen initialTab={communityTabOf(onglet)} />;
}
