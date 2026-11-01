import {
  bandeaux,
  fleurons,
  type IconName,
  icons,
  lettrines,
  type PlateName,
  type ToolName,
  tools,
} from "@leximon/tokens";
import { type ReactNode, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, fontSizes, fonts, space, theme } from "@/theme";
import { Button } from "@/ui/button";
import { Chip } from "@/ui/chip";
import { EmptyState } from "@/ui/empty-state";
import { Icon } from "@/ui/icon";
import { LevelMedal, XpBar } from "@/ui/level";
import { Matter } from "@/ui/matter";
import { Filet, Frame, Gilt, LettrineParagraph, Plate as Ornament, Tool } from "@/ui/ornament";
import { Page } from "@/ui/page";
import { Panel } from "@/ui/panel";
import { Leader, RuledRow } from "@/ui/ruled";
import { Segmented } from "@/ui/segmented";
import { Sheet } from "@/ui/sheet";
import { TextButton } from "@/ui/text-button";
import { TextField } from "@/ui/text-field";
import { Toggle } from "@/ui/toggle";

const ICON_NAMES = Object.keys(icons) as IconName[];
const TOOL_NAMES = Object.keys(tools) as ToolName[];

const VIEWS = [
  { value: "toutes", label: "Toutes" },
  { value: "doubles", label: "Doubles" },
  { value: "souhaits", label: "Souhaits" },
] as const;

const CAPITALS = Object.values(lettrines) as PlateName[];

function Plate({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <View style={styles.plate}>
      <Text style={styles.plateTitle}>{title}</Text>
      {children}
    </View>
  );
}

/**
 * Every component of Le Livre, in the theme this launch started with: the bars are around the
 * game's own screens.
 */
export function PlanchesScreen() {
  const [view, setView] = useState<(typeof VIEWS)[number]["value"]>("toutes");
  const [choice, setChoice] = useState<(typeof VIEWS)[number]["value"]>("doubles");
  const [sound, setSound] = useState(true);
  const [sheet, setSheet] = useState(false);
  return (
    <Page kicker="Le Livre" title={theme === "dark" ? "Cabinet de nuit" : "Page claire"}>
      <Plate title="Les boutons">
        <Button label="Ouvrir le sachet" onPress={() => undefined} />
        <Button label="Voir la carte" secondary onPress={() => undefined} />
        <Button label="Sachet vide" disabled onPress={() => undefined} />
        <TextButton label="Plus tard" onPress={() => undefined} />
      </Plate>

      <Plate title="Les panneaux et les listes">
        <Panel>
          <Text style={styles.text}>
            Un panneau tient un bloc de l'écran. Il reste sobre pour laisser la place au texte.
          </Text>
        </Panel>
        <Panel framed>
          <Text style={styles.text}>
            Le cadre imprimé réserve son effet à ce qui se détache de la page, comme le mot du jour.
          </Text>
        </Panel>
        <View>
          <RuledRow>
            <Text style={styles.text}>Abat-faim, n. m. Pièce de résistance d'un repas.</Text>
          </RuledRow>
          <RuledRow>
            <Text style={styles.text}>Aiguail, n. m. Rosée sur les feuilles.</Text>
          </RuledRow>
          <RuledRow last>
            <Text style={styles.text}>
              Avettes, n. f. pl. Abeilles, dans la langue d'autrefois.
            </Text>
          </RuledRow>
        </View>
        <View style={styles.leaders}>
          <Leader label="Cartes rares" value="12" />
          <Leader label="Défis réussis cette semaine" value="48" />
          <Leader label="Niveau du clan" value="5" />
        </View>
      </Plate>

      <Plate title="Les onglets, les champs et les puces">
        <Segmented options={VIEWS} value={view} onChange={setView} light />
        <Segmented options={VIEWS} value={choice} onChange={setChoice} />
        <TextField label="Pseudo" placeholder="Ton pseudo" />
        <View style={styles.toggleRow}>
          <Text style={styles.text}>Sons</Text>
          <Toggle label="Sons" value={sound} onChange={setSound} />
        </View>
        <View style={styles.row}>
          <Chip label="12 cartes" onPress={() => undefined} />
          <Chip label="Doubles" on onPress={() => undefined} />
        </View>
      </Plate>

      <Plate title="Les fenêtres">
        <Button label="Ouvrir une fiche" secondary onPress={() => setSheet(true)} />
        <Sheet open={sheet} title="Le mot du jour" onClose={() => setSheet(false)}>
          <Text style={styles.text}>Une fenêtre est une feuille tenue dans sa reliure.</Text>
          <Button label="Fermer" onPress={() => setSheet(false)} />
        </Sheet>
      </Plate>

      <Plate title="Le niveau et l'or">
        <View style={styles.row}>
          <LevelMedal level={7} size={34} />
          <LevelMedal level={16} size={48} />
          <LevelMedal level={120} size={72} />
        </View>
        <XpBar ratio={0.62} />
        <XpBar ratio={0.3} thin />
        <Gilt label="Coffret du niveau 10" />
      </Plate>

      <Plate title="Les états">
        <EmptyState message="Tu n'as encore aucun échange en cours." />
      </Plate>

      <Plate title="Les filets et les fers">
        <Filet />
        <Filet kind="gras-maigre" />
        <Filet kind="perle" />
        <Filet kind="fleuron" />
        <View style={styles.row}>
          {TOOL_NAMES.map((name) => (
            <Tool key={name} name={name} size={44} color={colors.pageInk} />
          ))}
        </View>
        <Frame color={colors.gilt} style={styles.bound}>
          <View style={styles.row}>
            {TOOL_NAMES.map((name) => (
              <Tool key={name} name={name} size={24} color={colors.gilt} />
            ))}
          </View>
        </Frame>
      </Plate>

      <Plate title="Les ornements anciens">
        <Ornament name="b01" width={320} />
        <LettrineParagraph text="Le mot rare se cache dans les vieux livres. Il attend qu'on tourne la page pour reprendre sa place dans la conversation." />
        <View style={styles.row}>
          {fleurons.map((name) => (
            <View key={name} style={styles.numbered}>
              <Ornament name={name} width={120} />
              <Text style={styles.number}>{name.toUpperCase()}</Text>
            </View>
          ))}
        </View>
        {bandeaux.map((name) => (
          <View key={name} style={styles.numbered}>
            <Ornament name={name} width={300} />
            <Text style={styles.number}>{name.toUpperCase()}</Text>
          </View>
        ))}
        <View style={styles.row}>
          {CAPITALS.map((name) => (
            <Ornament key={name} name={name} width={52} />
          ))}
        </View>
      </Plate>

      <Plate title="Les matières">
        <View style={styles.row}>
          {(["paper", "garde", "carnet"] as const).map((kind) => (
            <View key={kind} style={styles.swatch}>
              <Matter kind={kind} />
            </View>
          ))}
          <View style={[styles.swatch, styles.leather]}>
            <Matter kind="leather" />
          </View>
        </View>
      </Plate>

      <Plate title="Les icônes">
        <View style={styles.icons}>
          {ICON_NAMES.map((name) => (
            <Icon key={name} name={name} size={32} color={colors.pageInk} />
          ))}
        </View>
        <View style={styles.icons}>
          {ICON_NAMES.map((name) => (
            <Icon key={name} name={name} size={20} color={colors.pageInkMuted} />
          ))}
        </View>
      </Plate>
    </Page>
  );
}

const styles = StyleSheet.create({
  plate: { gap: space.s7, marginBottom: space.s12 },
  plateTitle: {
    fontFamily: fonts.ui.medium,
    fontSize: fontSizes.body,
    fontVariant: ["small-caps"],
    letterSpacing: 1.2,
    color: colors.pageInkMuted,
  },
  text: {
    flexShrink: 1,
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 23,
    color: colors.pageInk,
  },
  leaders: { gap: space.s3 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space.s8 },
  toggleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  bound: { padding: space.s16, alignItems: "center", backgroundColor: colors.binding },
  numbered: { alignItems: "center", gap: space.s2 },
  number: { fontFamily: fonts.ui.medium, fontSize: fontSizes.nano, color: colors.pageInkMuted },
  swatch: {
    width: 76,
    height: 76,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rule,
  },
  leather: { backgroundColor: colors.binding },
  icons: { flexDirection: "row", flexWrap: "wrap", gap: space.s6 },
});
