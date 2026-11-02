import { RARITIES, type Rarity } from "@leximon/core";
import {
  effects,
  rarityLights,
  revealEffects,
  type ToyIconName,
  type ToyMatterName,
  toyIcons,
} from "@leximon/tokens";
import { type ReactNode, useRef, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewInstance,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CollectionTitle,
  Desk,
  InfoBubble,
  LevelGauge,
  MailButton,
  MainAction,
  PaperAction,
  PortraitButton,
  Room,
  SideTile,
  StockButton,
  TabBar,
} from "@/library/play-pieces";
import { LibrarySachet } from "@/library/sachet";
import { colors, fontSizes, fonts, space } from "@/theme";
import { Avatar } from "@/ui/avatar";
import { ParticleStage, useStage } from "@/ui/stage";
import { Kicker, Leaf, Lettering, Toy, ToyIcon } from "@/ui/toy";

const COLLECTIONS = [
  { name: "Les Fondateurs", back: "night", tagline: "De l'abajoue à la logodiarrhée." },
  {
    name: "Caractères et travers",
    back: "burgundy",
    tagline: "Des mots pour railler les défauts de chacun.",
  },
  {
    name: "Métiers et objets disparus",
    back: "green",
    tagline: "Les gestes et les outils d'avant.",
  },
] as const;

const RARITY_NAMES: Readonly<Record<Rarity, string>> = {
  common: "Commune",
  uncommon: "Peu commune",
  rare: "Rare",
  precious: "Précieuse",
  epic: "Épique",
  legendary: "Légendaire",
};

const MATTERS: readonly ToyMatterName[] = ["gold", "red", "green", "blue", "paper", "locked"];
const ICON_NAMES = Object.keys(toyIcons) as ToyIconName[];

type Box = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

/** Where a view lies in the window, the frame the stage draws in. */
function measure(view: ViewInstance | null): Promise<Box | null> {
  return new Promise((resolve) => {
    if (view === null) resolve(null);
    else view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}

/**
 * The pieces of « La Bibliothèque », whatever the look of this build: the Jouer screen put
 * together, then each piece on its own, and the effects to set off by hand.
 */
export function PlanchesScreen() {
  return (
    <Room>
      <ParticleStage dust>
        <ScrollView contentContainerStyle={styles.scroll}>
          <PlayScreen />
          <View style={styles.plates}>
            <Plate title="Les objets">
              <Objects />
            </Plate>
            <Plate title="Le lettrage et la feuille">
              <Letters />
            </Plate>
            <Plate title="Les effets">
              <Effects />
            </Plate>
            <Plate title="Les icônes">
              <View style={styles.row}>
                {ICON_NAMES.map((name) => (
                  <ToyIcon key={name} name={name} size={44} />
                ))}
              </View>
            </Plate>
          </View>
        </ScrollView>
      </ParticleStage>
    </Room>
  );
}

function Plate({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <View style={styles.plate}>
      <Lettering size={22}>{title}</Lettering>
      {children}
    </View>
  );
}

/** The Jouer screen put together, the height of this phone. */
function PlayScreen() {
  const stage = useStage();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const sachet = useRef<ViewInstance>(null);
  const [index, setIndex] = useState(0);
  const [charging, setCharging] = useState(false);
  const [bubble, setBubble] = useState<{ readonly text: string } | null>(null);
  const collection = COLLECTIONS[index] ?? COLLECTIONS[0];

  const say = (text: string) => setBubble({ text });
  const turn = (step: number) =>
    setIndex((current) => (current + step + COLLECTIONS.length) % COLLECTIONS.length);

  const open = async () => {
    const box = await measure(sachet.current);
    if (box === null || charging) return;
    setCharging(true);
    const seam = { x: box.x + box.width / 2, y: box.y + 30 };
    let sparks = 0;
    const timer = setInterval(() => {
      sparks++;
      stage.burst(seam.x, seam.y, { ...effects.charge.burst, count: 1 + Math.floor(sparks / 4) });
    }, effects.charge.everyMs);
    setTimeout(() => {
      clearInterval(timer);
      const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      for (const settings of effects.burst) stage.burst(center.x, center.y, settings);
      stage.ring(center.x, center.y, rarityLights.epic[0] ?? colors.pageInk, 6);
      stage.flash(1, 500);
      stage.shake(10, 450);
      setCharging(false);
    }, 1100);
  };

  return (
    <View style={[styles.phone, { minHeight: height, paddingTop: insets.top + space.s4 }]}>
      <Desk style={[styles.desk, { top: insets.top + 84 }]} />
      <View style={styles.top}>
        <PortraitButton label="Mon profil" onPress={() => say("Ton profil s'ouvrirait ici.")}>
          <Avatar avatar={null} frame={null} size={40} />
        </PortraitButton>
        <LevelGauge level={7} progress={0.62} label="62 / 100" />
        <StockButton
          label="6 sachets sur 6"
          figure="6/6"
          onPress={() => say("Ton stock est plein.")}
        />
        <MailButton label="Courrier, 2 messages" count={2} />
      </View>
      <View style={styles.play}>
        <CollectionTitle
          kicker="Sachet"
          name={collection.name}
          tagline={collection.tagline}
          index={index}
          count={COLLECTIONS.length}
          previousLabel="Collection précédente"
          nextLabel="Collection suivante"
          onPrevious={() => turn(-1)}
          onNext={() => turn(1)}
        />
        <View style={styles.middle}>
          <View style={styles.side}>
            <SideTile
              icon="clan"
              matter="blue"
              label="Clan"
              lockedAt="Niv. 10"
              onPress={() => say("Le clan s'ouvre au niveau 10.")}
            />
            <SideTile
              icon="discussion"
              matter="green"
              label="Discussion"
              lockedAt="Niv. 10"
              onPress={() => say("La discussion s'ouvre au niveau 10.")}
            />
            <SideTile
              icon="jousts"
              matter="red"
              label="Joutes"
              lockedAt="Niv. 15"
              onPress={() => say("Les joutes s'ouvrent au niveau 15.")}
            />
          </View>
          <View ref={sachet} style={styles.sachet}>
            <LibrarySachet
              name={collection.name}
              back={collection.back}
              label="Ouvrir le sachet"
              countLabel="5 cartes"
              charging={charging}
              onOpen={() => void open()}
            />
          </View>
          <View style={styles.side}>
            <SideTile
              icon="challenge"
              matter="red"
              label="Défi du jour"
              badge="!"
              onPress={() => say("Le défi du jour t'attend : cinq mots à retrouver.")}
            />
            <SideTile
              icon="friends"
              matter="green"
              label="Amis"
              onPress={() => say("Tu as 3 amis.")}
            />
            <SideTile
              icon="chest"
              matter="blue"
              label="Récompenses"
              badge="1"
              onPress={({ nativeEvent }) =>
                stage.burst(nativeEvent.pageX, nativeEvent.pageY, effects.reward)
              }
            />
            <SideTile icon="settings" matter="gold" label="Réglages" />
          </View>
        </View>
        <View style={styles.cta}>
          <MainAction
            label="Ouvrir le sachet"
            count="6"
            inviting={!charging}
            onPress={() => void open()}
          />
        </View>
      </View>
      <TabBar
        playLabel="Jouer"
        bottomInset={insets.bottom}
        tabs={[
          { icon: "album", label: "Album" },
          { icon: "challenges", label: "Défis", badge: "1" },
          { icon: "trades", label: "Échanges", lockedAt: "Niv. 8" },
          { icon: "community", label: "Communauté" },
        ]}
        onTab={(tab) => {
          if (tab === 2) say("Les échanges s'ouvrent au niveau 8.");
        }}
      />
      <InfoBubble message={bubble} />
    </View>
  );
}

function Objects() {
  return (
    <View style={styles.objects}>
      <View style={styles.row}>
        {MATTERS.map((matter) => (
          <Toy key={matter} matter={matter} shape="tile" style={styles.sampleTile}>
            <ToyIcon name="sachet" size={34} locked={matter === "locked"} />
          </Toy>
        ))}
      </View>
      <View style={styles.row}>
        {MATTERS.map((matter) => (
          <Toy key={matter} matter={matter} style={styles.sampleBox}>
            <Lettering size={15}>{matter === "locked" ? "Fermé" : "Toucher"}</Lettering>
          </Toy>
        ))}
      </View>
      <MainAction label="Ouvrir un autre sachet" count="5" />
      <PaperAction label="Voir mes cartes" />
    </View>
  );
}

function Letters() {
  return (
    <View style={styles.letters}>
      <Lettering size={40}>Légendaire</Lettering>
      <Lettering size={24}>Caractères et travers</Lettering>
      <Lettering size={14}>Niv. 10 · 62 / 100</Lettering>
      <Kicker>Le mot</Kicker>
      <Leaf style={styles.leaf}>
        <Text style={styles.leafTitle}>abajoue</Text>
        <Text style={styles.leafText}>
          Poche que certains animaux, comme le hamster, ont dans la joue pour garder leur
          nourriture. Par plaisanterie, joue pendante d'une personne.
        </Text>
      </Leaf>
    </View>
  );
}

/** Each rarity's light, on a card-sized target. */
function Effects() {
  const stage = useStage();
  const target = useRef<ViewInstance>(null);
  const [shown, setShown] = useState<Rarity | null>(null);
  const reveal = async (rarity: Rarity) => {
    const box = await measure(target.current);
    if (box === null) return;
    setShown(rarity);
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    const effect = revealEffects[rarity];
    const run = () => stage.reveal(x, y, effect, rarityLights[rarity][0] ?? colors.pageInk);
    if (effect.drawInMs > 0) {
      stage.drawIn(x, y, rarityLights[rarity], effect.drawInMs);
      setTimeout(run, effect.drawInMs);
    } else {
      run();
    }
  };
  return (
    <View style={styles.effects}>
      <View ref={target} style={styles.target}>
        <Lettering size={18}>{shown === null ? "Une carte" : RARITY_NAMES[shown]}</Lettering>
      </View>
      <View style={styles.row}>
        {RARITIES.map((rarity) => (
          <Toy
            key={rarity}
            matter="paper"
            style={styles.effectButton}
            onPress={() => void reveal(rarity)}
          >
            <Lettering size={14}>{RARITY_NAMES[rarity]}</Lettering>
          </Toy>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: space.s16 },
  phone: { justifyContent: "space-between" },
  desk: { position: "absolute", left: 14, right: 14, bottom: 150 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  play: { flex: 1, alignItems: "center", paddingTop: 32, gap: 14 },
  middle: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center" },
  side: { gap: 6, paddingTop: 10 },
  sachet: { marginHorizontal: -6, paddingTop: 12 },
  cta: { width: "100%", alignItems: "center", paddingHorizontal: 32, marginTop: 28 },
  plates: { gap: space.s16, paddingHorizontal: 16, paddingTop: space.s16 },
  plate: { gap: space.s6 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "center" },
  objects: { gap: 16, alignItems: "center" },
  sampleTile: { width: 58, height: 58 },
  sampleBox: { height: 44, paddingHorizontal: 14 },
  letters: { gap: 10, alignItems: "flex-start" },
  leaf: { alignSelf: "stretch", padding: 16, gap: 6 },
  leafTitle: { color: colors.paperInk, fontFamily: fonts.display, fontSize: 24 },
  leafText: {
    color: colors.paperInk,
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.bodyLarge,
    lineHeight: 23,
  },
  effects: { gap: 16, alignItems: "center" },
  target: {
    width: 150,
    height: 210,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: colors.pageInkFaint,
    borderStyle: "dashed",
  },
  effectButton: { height: 40, paddingHorizontal: 12 },
});
