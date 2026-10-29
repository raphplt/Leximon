import { type ChangelogEntry, changelogDate } from "@leximon/view-model";
import { StyleSheet, Text, View } from "react-native";
import { colors, fonts } from "@/theme";

/** Entries of the changelog: a title, the day, what changed. */
export function NewsEntries({ entries }: { readonly entries: readonly ChangelogEntry[] }) {
  return (
    <View style={styles.list}>
      {entries.map((entry) => (
        <View key={entry.date} style={styles.entry}>
          <Text style={styles.title} accessibilityRole="header">
            {entry.title}
          </Text>
          <Text style={styles.date}>{changelogDate(entry.date)}</Text>
          {entry.items.map((item) => (
            <View key={item} style={styles.item}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.text}>{item}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 22 },
  entry: { gap: 8 },
  title: { fontFamily: fonts.display, fontSize: 20, lineHeight: 25, color: colors.text },
  date: { fontFamily: fonts.ui.semibold, fontSize: 13, color: colors.textMuted, marginBottom: 2 },
  item: { flexDirection: "row", gap: 8 },
  bullet: { fontFamily: fonts.ui.bold, fontSize: 15, lineHeight: 21, color: colors.accent },
  text: { flex: 1, fontFamily: fonts.ui.medium, fontSize: 15, lineHeight: 21, color: colors.text },
});
