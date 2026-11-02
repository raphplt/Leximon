import { RARITIES, type Rarity } from "@leximon/core";
import {
  cardSize,
  effects,
  rarityLights,
  revealBanner,
  revealEffects,
  type ToyIconName,
  type ToyMatterName,
  toyIcons,
} from "@leximon/tokens";
import { type RarityStaging, stagingFor } from "@leximon/view-model";
import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ViewInstance,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CardBack } from "@/cards/card-back";
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
import { Aura, RarityBanner, Rays, Sheen } from "@/library/reveal-pieces";
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

const CARD_WIDTH = 150;
const CARD_HEIGHT = (CARD_WIDTH * cardSize.height) / cardSize.width;
const TREMBLES: Readonly<Record<RarityStaging["announce"], number>> = {
  none: 0,
  edge: 0,
  tremble: 1.5,
  crack: 2.5,
  eclipse: 3.5,
};

type Moment = "rest" | "announce" | "waiting" | "turning" | "shown";

/**
 * One card turned as in the game: its announcement on the back, the player's touch from
 * Précieuse up, then the light of its rarity as the face shows.
 */
function Effects() {
  const stage = useStage();
  const target = useRef<ViewInstance>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [rarity, setRarity] = useState<Rarity>("common");
  const [moment, setMoment] = useState<Moment>("rest");
  const [stamp, setStamp] = useState(0);
  const [sweep, setSweep] = useState(0);
  const turn = useSharedValue(0);
  const tremble = useSharedValue(0);
  const pop = useSharedValue(1);
  const lift = useSharedValue(1);
  const staging = stagingFor(rarity, { reducedMotion: false, hurried: false });
  const effect = revealEffects[rarity];
  const light = rarityLights[rarity][0] ?? colors.pageInk;
  const banner = revealBanner[rarity];

  const later = (ms: number, action: () => void) => {
    timers.current.push(setTimeout(action, ms));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const shiver = (strength: number, ms: number) => {
    if (strength === 0) return;
    const steps = Math.max(2, Math.round(ms / 45));
    tremble.value = withSequence(
      ...Array.from({ length: steps }, (_, index) =>
        withTiming((index % 2 === 0 ? 1 : -1) * strength * (0.6 + index / steps), {
          duration: 45,
        }),
      ),
      withTiming(0, { duration: 45 }),
    );
  };

  const turnOver = (chosen: Rarity, flipMs: number) => {
    setMoment("turning");
    pop.value = withSequence(
      withTiming(1.18, { duration: flipMs / 2 }),
      withTiming(1, { duration: flipMs / 2, easing: Easing.out(Easing.back(2)) }),
    );
    turn.value = withTiming(1, { duration: flipMs, easing: Easing.inOut(Easing.cubic) });
    later(flipMs / 2, async () => {
      const box = await measure(target.current);
      if (box !== null) {
        const chosenLight = rarityLights[chosen][0] ?? colors.pageInk;
        stage.reveal(
          box.x + box.width / 2,
          box.y + box.height / 2,
          revealEffects[chosen],
          chosenLight,
        );
      }
      setSweep((value) => value + 1);
      if (revealBanner[chosen] !== undefined) setStamp((value) => value + 1);
      if (stagingFor(chosen, { reducedMotion: false, hurried: false }).spotlight) {
        lift.value = withSpring(1.12, { damping: 10 });
      }
      setMoment("shown");
    });
  };

  const draw = async (chosen: Rarity) => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRarity(chosen);
    turn.value = 0;
    lift.value = withTiming(1, { duration: 200 });
    const chosenStaging = stagingFor(chosen, { reducedMotion: false, hurried: false });
    if (chosenStaging.flip === "instant") {
      turnOver(chosen, chosenStaging.flipMs);
      return;
    }
    setMoment("announce");
    shiver(TREMBLES[chosenStaging.announce], chosenStaging.announceMs);
    later(chosenStaging.announceMs, () => {
      if (chosenStaging.flip === "auto") turnOver(chosen, chosenStaging.flipMs);
      else setMoment("waiting");
    });
  };

  const touch = async () => {
    if (moment !== "waiting") return;
    setMoment("turning");
    if (effect.drawInMs > 0) {
      const box = await measure(target.current);
      if (box !== null) {
        stage.drawIn(
          box.x + box.width / 2,
          box.y + box.height / 2,
          rarityLights[rarity],
          effect.drawInMs,
        );
      }
      shiver(TREMBLES[staging.announce] * 1.6, effect.drawInMs);
    }
    later(effect.drawInMs, () => turnOver(rarity, staging.flipMs));
  };

  const card = useAnimatedStyle(() => ({
    transform: [
      { translateX: tremble.value },
      { rotate: `${tremble.value * 0.6}deg` },
      { scale: pop.value * lift.value },
    ],
  }));
  const back = useAnimatedStyle(() => ({
    opacity: turn.value < 0.5 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${turn.value * 180}deg` }],
  }));
  const face = useAnimatedStyle(() => ({
    opacity: turn.value >= 0.5 ? 1 : 0,
    transform: [{ perspective: 1200 }, { rotateY: `${(turn.value - 1) * 180}deg` }],
  }));
  const announced = moment === "announce" || moment === "waiting" || moment === "turning";
  const auraStrength =
    moment === "rest" || (staging.announce === "none" && moment !== "shown")
      ? 0
      : announced
        ? 0.9
        : rarity === "common"
          ? 0.25
          : 0.6;

  return (
    <View style={styles.effects}>
      <Text style={styles.effectsNote}>
        Dans le jeu, ces effets jouent à l'ouverture d'un sachet, quand chaque carte se retourne.
        Plus la carte est rare, plus son annonce dure, et à partir de Précieuse c'est toi qui la
        retournes.
      </Text>
      <View style={styles.revealZone}>
        <Aura size={CARD_WIDTH * 2.6} color={light} strength={auraStrength} />
        <Rays size={CARD_WIDTH * 3} color={light} shown={moment === "shown" && effect.rays} />
        <Pressable
          ref={target}
          onPress={() => void touch()}
          disabled={moment !== "waiting"}
          accessibilityRole="button"
          accessibilityLabel="Retourner la carte"
        >
          <Animated.View style={[styles.demoCard, card]}>
            <Animated.View style={[StyleSheet.absoluteFill, back]}>
              <CardBack width={CARD_WIDTH} tone="night" />
            </Animated.View>
            <Animated.View style={[StyleSheet.absoluteFill, face]}>
              <Leaf style={[styles.demoFace, { borderColor: light }]}>
                <Text style={styles.demoRarity}>{RARITY_NAMES[rarity].toUpperCase()}</Text>
                <Text style={styles.demoWord}>abajoue</Text>
                <Sheen width={CARD_WIDTH} sweep={sweep} />
              </Leaf>
            </Animated.View>
          </Animated.View>
        </Pressable>
        {banner !== undefined && (
          <RarityBanner text={RARITY_NAMES[rarity]} color={banner} stamp={stamp} />
        )}
      </View>
      <Text style={styles.effectsHint}>
        {moment === "waiting" ? "Touche la carte pour la retourner." : " "}
      </Text>
      <View style={styles.row}>
        {RARITIES.map((choice) => (
          <Toy
            key={choice}
            matter="paper"
            style={styles.effectButton}
            onPress={() => void draw(choice)}
          >
            <Lettering size={14}>{RARITY_NAMES[choice]}</Lettering>
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
  side: { gap: 8, paddingTop: 10 },
  sachet: { marginHorizontal: -12, paddingTop: 12 },
  cta: {
    width: "100%",
    alignItems: "center",
    paddingHorizontal: 32,
    marginTop: 20,
    marginBottom: 48,
  },
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
  effectsNote: {
    color: colors.pageInk,
    fontFamily: fonts.text.regular,
    fontSize: fontSizes.body,
    lineHeight: 21,
  },
  revealZone: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginVertical: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  demoCard: { width: CARD_WIDTH, height: CARD_HEIGHT },
  demoFace: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 4,
  },
  demoRarity: {
    color: colors.paperInk,
    fontFamily: fonts.ui.extrabold,
    fontSize: 10,
    letterSpacing: 2,
  },
  demoWord: { color: colors.paperInk, fontFamily: fonts.display, fontSize: 24 },
  effectsHint: {
    color: colors.pageInk,
    fontFamily: fonts.ui.extrabold,
    fontSize: fontSizes.body,
  },
  effectButton: { height: 40, paddingHorizontal: 12 },
});
