import { playerCodeSchema } from "@leximon/contract";
import { useLocalSearchParams } from "expo-router";
import { AlbumScreen } from "@/screens/album/album-screen";

export default function AlbumRoute() {
  // `ami`: a friend's code, to set their album beside the player's.
  const params = useLocalSearchParams<{ ami?: string }>();
  const code = playerCodeSchema.safeParse(params.ami);
  return <AlbumScreen friendCode={code.success ? code.data : null} />;
}
