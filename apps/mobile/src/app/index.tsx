import type { BoosterWalletResponse } from "@leximon/contract";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { api } from "@/api/client";

export default function Home() {
  const [wallet, setWallet] = useState<BoosterWalletResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.fetchWallet().then(setWallet, (reason: unknown) => setError(String(reason)));
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Leximon</Text>
      <Text>{wallet ? `${wallet.stored} sachets` : (error ?? "…")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 32 },
});
