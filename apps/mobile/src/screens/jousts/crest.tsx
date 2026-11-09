import type { LeagueId } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import { leagueNumeral } from "@leximon/view-model";
import { useId } from "react";
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from "react-native-svg";
import { fonts } from "@/theme";

/**
 * Each league's crest, richer from one league to the next: its field, the metal of its rim, and
 * what stands behind it (lances, a pennant, batons, a sword, laurels). As on the web.
 */
const CRESTS: Readonly<
  Record<
    LeagueId,
    {
      readonly field: keyof typeof toyMatters;
      readonly rim: "bronze" | "silver" | "gold";
      readonly behind: "none" | "lances" | "pennant" | "batons" | "sword" | "laurels";
    }
  >
> = {
  page: { field: "paper", rim: "bronze", behind: "none" },
  ecuyer: { field: "green", rim: "bronze", behind: "lances" },
  chevalier: { field: "blue", rim: "silver", behind: "lances" },
  banneret: { field: "red", rim: "silver", behind: "pennant" },
  marechal: { field: "dark", rim: "gold", behind: "batons" },
  connetable: { field: "blue", rim: "gold", behind: "sword" },
  champion: { field: "red", rim: "gold", behind: "laurels" },
};

/** The rims, from the lit edge to the shade, in the toys' metals. */
const RIMS = {
  bronze: [toyMatters.paper.edge, toyMatters.gold.edge, toyMatters.dark.top],
  silver: [toyMatters.paper.top, toyMatters.locked.top, toyMatters.locked.edge],
  gold: [toyMatters.gold.top, toyMatters.gold.bottom, toyMatters.gold.edge],
} as const;

const SHIELD = "M50 14 L82 24 V52 C82 74 67 88 50 96 C33 88 18 74 18 52 V24 Z";
const FIELD = "M50 20 L76 28.5 V52 C76 70 64 82 50 89 C36 82 24 70 24 52 V28.5 Z";

/** A league's crest, drawn on a 100 × 116 grid; `dim` greys a league not reached yet. */
export function Crest({
  league,
  size,
  dim = false,
}: {
  readonly league: LeagueId;
  readonly size: number;
  readonly dim?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const crest = CRESTS[league];
  const field = toyMatters[dim ? "locked" : crest.field];
  const rim = RIMS[dim ? "silver" : crest.rim];
  const numeral = leagueNumeral(league);
  const ink = toyValues.outline;
  const light = !dim && (crest.field === "paper" || crest.field === "gold");
  const rimFill = `url(#${id}r)`;
  return (
    <Svg width={size} height={size * 1.16} viewBox="0 -6 100 116" accessible={false}>
      <Defs>
        <LinearGradient id={`${id}f`} x1="0" y1="0" x2="0.3" y2="1">
          <Stop offset="0" stopColor={field.top} />
          <Stop offset="1" stopColor={field.bottom} />
        </LinearGradient>
        <LinearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={rim[0]} />
          <Stop offset="0.45" stopColor={rim[1]} />
          <Stop offset="1" stopColor={rim[2]} />
        </LinearGradient>
      </Defs>

      <Behind kind={crest.behind} rim={rimFill} ink={ink} dim={dim} />

      <Path d={SHIELD} fill={rimFill} stroke={ink} strokeWidth={3} strokeLinejoin="round" />
      <Path d={FIELD} fill={`url(#${id}f)`} stroke={ink} strokeWidth={1.5} strokeOpacity={0.5} />
      <Path
        d="M50 25 L71 32 V52 C71 67 61 77 50 83 C39 77 29 67 29 52 V32 Z"
        fill="none"
        stroke={rim[0]}
        strokeWidth={1.2}
        strokeOpacity={0.7}
      />
      <Path d="M27 31 L50 23.5 L73 31" fill="none" stroke={toyValues.sheen} strokeWidth={2.5} />

      {numeral === null ? (
        <Path
          d="M34 64 L37 44 L44 53 L50 40 L56 53 L63 44 L66 64 Z"
          fill={rimFill}
          stroke={ink}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      ) : (
        // The outline first, then the numeral over it: react-native-svg has no paint order.
        (light ? [ink] : [ink, toyMatters.paper.top]).map((color, layer) => (
          <SvgText
            key={color}
            x="50"
            y="64"
            textAnchor="middle"
            fontFamily={fonts.display}
            fontSize={numeral.length > 2 ? 22 : 27}
            fill={color}
            stroke={!light && layer === 0 ? ink : "none"}
            strokeWidth={!light && layer === 0 ? 4.8 : 0}
          >
            {numeral}
          </SvgText>
        ))
      )}

      {league === "champion" && !dim && (
        <G stroke={ink} strokeWidth={2.4} strokeLinejoin="round">
          <Path d="M30 18 L33 2 L42 11 L50 -1 L58 11 L67 2 L70 18 Z" fill={rimFill} />
          <Circle cx="50" cy="8" r="3" fill={toyMatters.red.top} strokeWidth={1.5} />
        </G>
      )}
    </Svg>
  );
}

/** What stands behind the shield. */
function Behind({
  kind,
  rim,
  ink,
  dim,
}: {
  readonly kind: (typeof CRESTS)[LeagueId]["behind"];
  readonly rim: string;
  readonly ink: string;
  readonly dim: boolean;
}) {
  const wood = dim ? toyMatters.locked.bottom : toyMatters.dark.top;
  const cloth = dim ? toyMatters.locked.top : toyMatters.red.top;
  switch (kind) {
    case "none":
      return null;
    case "lances":
      return (
        <G stroke={ink} strokeWidth={2.2} strokeLinejoin="round">
          <Path d="M14 98 L84 8 L88 11 L19 101 Z" fill={wood} />
          <Path d="M86 98 L16 8 L12 11 L81 101 Z" fill={wood} />
          <Path d="M84 8 L92 2 L88 11 Z" fill={rim} />
          <Path d="M16 8 L8 2 L12 11 Z" fill={rim} />
        </G>
      );
    case "pennant":
      return (
        <G stroke={ink} strokeWidth={2.2} strokeLinejoin="round">
          <Path d="M14 98 L84 8 L88 11 L19 101 Z" fill={wood} />
          <Path d="M86 98 L16 8 L12 11 L81 101 Z" fill={wood} />
          <Path d="M84 9 L99 13 L90 18 L98 24 L80 20 Z" fill={cloth} />
          <Path d="M16 9 L1 13 L10 18 L2 24 L20 20 Z" fill={cloth} />
        </G>
      );
    case "batons": {
      const baton = dim ? cloth : toyMatters.blue.bottom;
      return (
        <G stroke={ink} strokeWidth={2.2} strokeLinejoin="round">
          <Path d="M10 92 L82 12 L88 17 L16 97 Z" fill={baton} />
          <Path d="M90 92 L18 12 L12 17 L84 97 Z" fill={baton} />
          <Circle cx="85" cy="14" r="5" fill={rim} />
          <Circle cx="15" cy="14" r="5" fill={rim} />
          <Circle cx="13" cy="95" r="5" fill={rim} />
          <Circle cx="87" cy="95" r="5" fill={rim} />
        </G>
      );
    }
    case "sword":
      return (
        <G stroke={ink} strokeWidth={2.2} strokeLinejoin="round">
          <Path d="M47 4 L50 -2 L53 4 V104 H47 Z" fill={toyMatters.paper.top} />
          <Path d="M30 10 H70 V16 H30 Z" fill={rim} />
          <Path d="M47 104 H53 V110 H47 Z" fill={rim} />
        </G>
      );
    case "laurels":
      return (
        <G
          stroke={ink}
          strokeWidth={1.8}
          strokeLinejoin="round"
          fill={dim ? cloth : toyMatters.green.top}
        >
          {[0, 1, 2, 3, 4].map((leaf) => (
            <G key={leaf}>
              <Ellipse
                cx={18 - leaf * 0.5}
                cy={88 - leaf * 15}
                rx="5"
                ry="10"
                rotation={-35 + leaf * 9}
                origin={`${18 - leaf * 0.5}, ${88 - leaf * 15}`}
              />
              <Ellipse
                cx={82 + leaf * 0.5}
                cy={88 - leaf * 15}
                rx="5"
                ry="10"
                rotation={35 - leaf * 9}
                origin={`${82 + leaf * 0.5}, ${88 - leaf * 15}`}
              />
            </G>
          ))}
        </G>
      );
  }
}
