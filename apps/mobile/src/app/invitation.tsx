import { StyleSheet, Text, View } from "react-native";

export default function Invitation() {
  return (
    <View style={styles.container}>
      <Text>Sur invitation.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center" },
});
