import { type ChangelogEntry, changelogDate } from "@leximon/view-model";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, space } from "@/theme";

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
  entry: { gap: space.s4 },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSizes.titleSmall,
    lineHeight: 25,
    color: colors.pageInk,
  },
  date: {
    fontFamily: fonts.ui.semibold,
    fontSize: fontSizes.small,
    color: colors.pageInkMuted,
    marginBottom: space.s1,
  },
  item: { flexDirection: "row", gap: space.s4 },
  bullet: {
    fontFamily: fonts.ui.bold,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.rubric,
  },
  text: {
    flex: 1,
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    lineHeight: 21,
    color: colors.pageInk,
  },
});
