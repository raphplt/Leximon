import { playerCodeSchema } from "@leximon/contract";
import { useLocalSearchParams } from "expo-router";
import { FriendsScreen } from "@/screens/friends/friends-screen";

export default function FriendsRoute() {
  // `ajouter`: the code of a friend link followed by a player who already plays.
  const params = useLocalSearchParams<{ ajouter?: string }>();
  const code = playerCodeSchema.safeParse(params.ajouter);
  return <FriendsScreen adding={code.success ? code.data : null} />;
}
