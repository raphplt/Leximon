import { useLocalSearchParams } from "expo-router";
import { CabinetScreen } from "@/screens/card/cabinet-screen";

export default function CabinetRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CabinetScreen cardId={id} />;
}
