import { useLocalSearchParams } from "expo-router";
import { CardSheet } from "@/screens/card/card-sheet";

export default function CardRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <CardSheet cardId={id} />;
}
