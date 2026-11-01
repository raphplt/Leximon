"use client";

import {
  bandeaux,
  bookTheme,
  fleurons,
  icons,
  lettrines,
  type PlateName,
  type ToolName,
  tools,
} from "@leximon/tokens";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import bars from "@/shell/bars.module.css";
import { Button, RoundButton } from "@/ui/button";
import { Chip, ChipButton } from "@/ui/chip";
import { Dialog } from "@/ui/dialog";
import { EmptyState } from "@/ui/empty-state";
import { Icon, type IconName } from "@/ui/icon";
import { LevelMedal, XpBar } from "@/ui/level-bits";
import { LoadFailed } from "@/ui/load-failed";
import { Logo } from "@/ui/logo";
import { Filet, Gilt, LettrineParagraph, Plate as Ornament, Tool } from "@/ui/ornament";
import { Panel } from "@/ui/panel";
import { Leader, Leaders, RuledList, RuledRow } from "@/ui/ruled";
import { Bone } from "@/ui/skeleton";
import { Switch } from "@/ui/switch";
import { Segmented, Tabs } from "@/ui/tabs";
import ui from "@/ui/ui.module.css";
import styles from "./planches.module.css";

const THEMES = [
  { theme: "light", name: "Page claire" },
  { theme: "dark", name: "Cabinet de nuit" },
] as const;

const ICON_NAMES = Object.keys(icons) as IconName[];
const TOOL_NAMES = Object.keys(tools) as ToolName[];

/** Every component of Le Livre, in both themes at once, whatever the look of this browser. */
export function Planches() {
  return (
    <main className={styles.page}>
      {THEMES.map(({ theme, name }) => (
        <div
          key={theme}
          data-look="livre"
          className={styles.sheet}
          style={{ ...bookTheme(theme), colorScheme: theme } as CSSProperties}
        >
          <h1 className={styles.title}>{name}</h1>
          <Bindings />
          <Buttons />
          <Surfaces />
          <Controls />
          <Windows />
          <Rewards />
          <States />
          <Ornaments />
          <OldOrnaments />
          <Matters />
          <Engravings />
        </div>
      ))}
    </main>
  );
}

function Plate({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className={styles.plate}>
      <h2 className={ui.kicker}>{title}</h2>
      {children}
    </section>
  );
}

const NAV: readonly { readonly icon: IconName; readonly label: string }[] = [
  { icon: "sachet", label: "Jouer" },
  { icon: "album", label: "Album" },
  { icon: "defi", label: "Défis" },
  { icon: "echange", label: "Échanges" },
  { icon: "clan", label: "Communauté" },
];

function Bindings() {
  return (
    <Plate title="La reliure">
      <header className={`${bars.top} ${styles.wideBar}`}>
        <span className={bars.logoLink}>
          <Logo size="sm" />
        </span>
        <nav className={bars.nav} aria-label="Exemple de navigation">
          {NAV.map(({ icon, label }, index) => (
            <span key={label} className={bars.navLink} data-active={index === 0}>
              <Icon name={icon} size={20} />
              <span className={bars.navLabel}>{label}</span>
            </span>
          ))}
        </nav>
        <div className={bars.side}>
          <span className={ui.chip}>
            <Icon name="sachet" size={16} />
            3/12
          </span>
          <span className={ui.round}>
            <Icon name="courrier" size={20} />
            <span className={`${ui.badge} ${bars.badgeBar}`}>2</span>
          </span>
        </div>
      </header>
      <header className={`${bars.phoneTop} ${styles.narrowBar}`}>
        <span className={bars.phoneAvatar}>
          <Icon name="profil" size={24} />
        </span>
        <span className={bars.phoneXp}>
          <LevelMedal level={7} size={34} />
          <XpBar ratio={0.6} thin className={bars.levelBar} />
        </span>
        <span className={bars.spacer} />
        <span className={`${ui.chip} ${bars.chipCompact}`}>
          <Icon name="sachet" size={16} />
          3/12
        </span>
        <span className={`${ui.round} ${bars.roundCompact}`}>
          <Icon name="courrier" size={19} />
        </span>
      </header>
      <nav className={`${bars.tabs} ${styles.staticTabs}`} aria-label="Exemple d'onglets">
        {NAV.slice(1, 3).map(({ icon, label }) => (
          <span key={label} className={bars.tab}>
            <span className={bars.tabPill}>
              <Icon name={icon} size={22} />
            </span>
            <span className={bars.tabLabel}>{label}</span>
          </span>
        ))}
        <span className={bars.tabPlay}>
          <span className={bars.tabPlayCircle}>
            <Icon name="sachet" size={30} />
          </span>
          <span className={bars.tabLabel}>Jouer</span>
        </span>
        {NAV.slice(3).map(({ icon, label }) => (
          <span key={label} className={bars.tab}>
            <span className={bars.tabPill}>
              <Icon name={icon} size={22} />
            </span>
            <span className={bars.tabLabel}>{label}</span>
          </span>
        ))}
      </nav>
    </Plate>
  );
}

function Buttons() {
  return (
    <Plate title="Les boutons">
      <div className={styles.row}>
        <Button>Ouvrir le sachet</Button>
        <Button variant="secondary">Voir la carte</Button>
        <Button variant="ghost">Plus tard</Button>
      </div>
      <div className={styles.row}>
        <Button small>Valider</Button>
        <Button variant="secondary" small>
          Annuler
        </Button>
        <Button disabled>Sachet vide</Button>
        <RoundButton label="Fermer">
          <Icon name="close" size={18} />
        </RoundButton>
      </div>
    </Plate>
  );
}

function Surfaces() {
  return (
    <Plate title="Les panneaux et les listes">
      <Panel className={styles.panel}>
        <p className={styles.text}>
          Un panneau tient un bloc de l'écran. Il reste sobre pour laisser la place au texte.
        </p>
      </Panel>
      <Panel framed className={styles.framedPanel}>
        <p className={styles.text}>
          Le cadre imprimé réserve son effet à ce qui se détache de la page, comme le mot du jour.
        </p>
      </Panel>
      <RuledList>
        <RuledRow>
          <b>Abat-faim</b> <i>n. m.</i> Pièce de résistance d'un repas.
        </RuledRow>
        <RuledRow>
          <b>Aiguail</b> <i>n. m.</i> Rosée sur les feuilles.
        </RuledRow>
        <RuledRow>
          <b>Avettes</b> <i>n. f. pl.</i> Abeilles, dans la langue d'autrefois.
        </RuledRow>
      </RuledList>
      <Leaders>
        <Leader label="Cartes rares">12</Leader>
        <Leader label="Défis réussis cette semaine">48</Leader>
        <Leader label="Niveau du clan">5</Leader>
      </Leaders>
    </Plate>
  );
}

const VIEWS = [
  { value: "toutes", label: "Toutes" },
  { value: "doubles", label: "Doubles" },
  { value: "souhaits", label: "Souhaits" },
] as const;

function Controls() {
  const [tab, setTab] = useState<(typeof VIEWS)[number]["value"]>("toutes");
  const [segment, setSegment] = useState<(typeof VIEWS)[number]["value"]>("doubles");
  const [sound, setSound] = useState(true);
  const [vibration, setVibration] = useState(false);
  const [filter, setFilter] = useState(true);
  return (
    <Plate title="Les onglets, les champs et les puces">
      <Tabs label="Exemple d'onglets" options={VIEWS} value={tab} onChange={setTab} />
      <Segmented label="Exemple de choix" options={VIEWS} value={segment} onChange={setSegment} />
      <input className={ui.field} placeholder="Ton pseudo" aria-label="Exemple de champ" />
      <div>
        <Switch
          label="Sons"
          detail="Bruit du papier à l'ouverture"
          checked={sound}
          onChange={setSound}
        />
        <Switch label="Vibrations" checked={vibration} onChange={setVibration} />
      </div>
      <div className={styles.row}>
        <Chip>12 cartes</Chip>
        <Chip gold>Rare</Chip>
        <ChipButton on={filter} onClick={() => setFilter(!filter)}>
          Doubles
        </ChipButton>
        <ChipButton>Souhaits</ChipButton>
      </div>
    </Plate>
  );
}

function Windows() {
  const [open, setOpen] = useState<"side" | "center" | "wide" | null>(null);
  return (
    <Plate title="Les fenêtres">
      <div className={styles.row}>
        <Button variant="secondary" small onClick={() => setOpen("center")}>
          Fenêtre
        </Button>
        <Button variant="secondary" small onClick={() => setOpen("side")}>
          Panneau latéral
        </Button>
        <Button variant="secondary" small onClick={() => setOpen("wide")}>
          Grande fenêtre
        </Button>
      </div>
      {(["center", "side", "wide"] as const).map((variant) => (
        <Dialog
          key={variant}
          open={open === variant}
          title="Le mot du jour"
          variant={variant}
          onClose={() => setOpen(null)}
        >
          <p className={styles.text}>
            Une fenêtre est une feuille tenue dans sa reliure. Sur téléphone, le panneau latéral et
            la grande fenêtre montent du bas de l'écran.
          </p>
          <Button onClick={() => setOpen(null)}>Fermer</Button>
        </Dialog>
      ))}
    </Plate>
  );
}

function Rewards() {
  return (
    <Plate title="Le niveau et l'or">
      <div className={styles.row}>
        <LevelMedal level={7} size={34} />
        <LevelMedal level={16} size={48} />
        <LevelMedal level={120} size={72} />
      </div>
      <XpBar ratio={0.62} />
      <XpBar ratio={0.3} thin />
      <div className={styles.row}>
        <Gilt>Coffret du niveau 10</Gilt>
      </div>
    </Plate>
  );
}

function States() {
  return (
    <Plate title="Les états">
      <EmptyState action={<Button variant="secondary">Voir les offres</Button>}>
        Tu n'as encore aucun échange en cours.
      </EmptyState>
      <div className={styles.bones}>
        <Bone style={{ height: 18, width: "70%" }} />
        <Bone style={{ height: 18, width: "90%" }} />
        <Bone style={{ height: 18, width: "50%" }} />
      </div>
      <LoadFailed onRetry={() => undefined} />
    </Plate>
  );
}

function Ornaments() {
  return (
    <Plate title="Les filets et les fers">
      <Filet />
      <Filet kind="gras-maigre" />
      <Filet kind="perle" />
      <Filet kind="fleuron" />
      <Filet kind="fleuron" tool="rosette" />
      <div className={styles.tools}>
        {TOOL_NAMES.map((name) => (
          <Tool key={name} name={name} size={44} />
        ))}
      </div>
      <div className={styles.leather}>
        <div className={styles.leatherFrame}>
          {TOOL_NAMES.map((name) => (
            <Tool key={name} name={name} size={26} />
          ))}
        </div>
      </div>
    </Plate>
  );
}

function Numbered({ name, width }: { readonly name: PlateName; readonly width: number }) {
  return (
    <figure className={styles.numbered}>
      <Ornament name={name} width={width} />
      <figcaption className={styles.number}>{name.toUpperCase()}</figcaption>
    </figure>
  );
}

const CAPITALS = Object.values(lettrines) as PlateName[];

function OldOrnaments() {
  return (
    <Plate title="Les ornements anciens">
      <Ornament name="b01" width={420} />
      <LettrineParagraph>
        Le mot rare se cache dans les vieux livres. Il attend qu'on tourne la page pour reprendre sa
        place dans la conversation, et chaque carte en ramène un à la lumière.
      </LettrineParagraph>
      <div className={styles.plates}>
        {fleurons.map((name) => (
          <Numbered key={name} name={name} width={120} />
        ))}
      </div>
      <div className={styles.plates}>
        {bandeaux.map((name) => (
          <Numbered key={name} name={name} width={300} />
        ))}
      </div>
      <div className={styles.capitals}>
        {CAPITALS.map((name) => (
          <Numbered key={name} name={name} width={52} />
        ))}
      </div>
    </Plate>
  );
}

function Matters() {
  return (
    <Plate title="Les matières">
      <div className={styles.matters}>
        <span className={styles.paper}>Papier</span>
        <span className={styles.garde}>Garde</span>
        <span className={styles.carnet}>Carnet</span>
        <span className={styles.leather}>Cuir</span>
      </div>
    </Plate>
  );
}

function Engravings() {
  return (
    <Plate title="Les icônes">
      <div className={styles.icons}>
        {ICON_NAMES.map((name) => (
          <Icon key={name} name={name} size={40} />
        ))}
      </div>
      <div className={styles.iconsSmall}>
        {ICON_NAMES.map((name) => (
          <Icon key={name} name={name} size={22} />
        ))}
      </div>
    </Plate>
  );
}
