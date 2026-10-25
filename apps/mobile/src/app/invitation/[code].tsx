import { inviteCodeSchema } from "@leximon/contract";
import { useLocalSearchParams } from "expo-router";
import { InvitationScreen } from "@/screens/beta/invitation-screen";

export default function InvitationRoute() {
  const params = useLocalSearchParams<{ code: string }>();
  const code = inviteCodeSchema.safeParse(params.code);
  return <InvitationScreen code={code.success ? code.data : null} />;
}
