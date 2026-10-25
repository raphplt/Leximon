import { useLocalSearchParams } from "expo-router";
import { PublicProfileScreen } from "@/screens/profile/public-profile-screen";

export default function PublicProfileRoute() {
  const { pseudo } = useLocalSearchParams<{ pseudo: string }>();
  return <PublicProfileScreen key={pseudo} pseudo={pseudo} />;
}
