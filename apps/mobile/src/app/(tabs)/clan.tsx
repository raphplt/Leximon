import { communitySectionFrom } from "@leximon/view-model";
import { useLocalSearchParams } from "expo-router";
import { CommunityTab } from "@/screens/community/community-tab";

export default function Screen() {
  // `code`: an invitation link to a clan. `section`: a link to the friends or a list.
  const { code, section } = useLocalSearchParams<{ code?: string; section?: string }>();
  return <CommunityTab section={communitySectionFrom(section)} code={code ?? null} />;
}
