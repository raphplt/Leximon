import { playerCodeSchema } from "@leximon/contract";
import { useLocalSearchParams } from "expo-router";
import { ReferrerScreen } from "@/screens/beta/referrer-screen";

export default function ReferrerRoute() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = playerCodeSchema.safeParse(params.code);
  return <ReferrerScreen code={code.success ? code.data : null} />;
}
