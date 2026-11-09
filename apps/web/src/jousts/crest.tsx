import type { LeagueId } from "@leximon/contract";
import { toyMatters, toy as toyValues } from "@leximon/tokens";
import { leagueNumeral } from "@leximon/view-model";
import { useId } from "react";

/**
 * Each league's crest, richer from one league to the next: its field, the metal of its rim, and
 * what stands behind it (lances, a pennant, batons, a sword, laurels).
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
  const id = useId();
  const crest = CRESTS[league];
  const field = toyMatters[dim ? "locked" : crest.field];
  const rim = RIMS[dim ? "silver" : crest.rim];
  const numeral = leagueNumeral(league);
  const ink = toyValues.outline;
  const light = !dim && (crest.field === "paper" || crest.field === "gold");
  return (
    <svg width={size} height={size * 1.16} viewBox="0 -6 100 116" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor={field.top} />
          <stop offset="1" stopColor={field.bottom} />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={rim[0]} />
          <stop offset="0.45" stopColor={rim[1]} />
          <stop offset="1" stopColor={rim[2]} />
        </linearGradient>
      </defs>

      <Behind kind={crest.behind} rim={`url(#${id}r)`} ink={ink} dim={dim} />

      {/* The shield: its rim of metal, its field, a gilt fillet and the light along its top. */}
      <path d={SHIELD} fill={`url(#${id}r)`} stroke={ink} strokeWidth="3" strokeLinejoin="round" />
      <path d={FIELD} fill={`url(#${id}f)`} stroke={ink} strokeWidth="1.5" strokeOpacity="0.5" />
      <path
        d="M50 25 L71 32 V52 C71 67 61 77 50 83 C39 77 29 67 29 52 V32 Z"
        fill="none"
        stroke={rim[0]}
        strokeWidth="1.2"
        strokeOpacity="0.7"
      />
      <path d="M27 31 L50 23.5 L73 31" fill="none" stroke={toyValues.sheen} strokeWidth="2.5" />

      {numeral === null ? (
        <path
          d="M34 64 L37 44 L44 53 L50 40 L56 53 L63 44 L66 64 Z"
          fill={`url(#${id}r)`}
          stroke={ink}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
      ) : (
        <text
          x="50"
          y="64"
          textAnchor="middle"
          fontFamily="var(--font-display), Georgia, serif"
          fontWeight="900"
          fontSize={numeral.length > 2 ? 22 : 27}
          fill={light ? ink : toyMatters.paper.top}
          stroke={light ? "none" : ink}
          strokeWidth="2.4"
          paintOrder="stroke"
        >
          {numeral}
        </text>
      )}

      {league === "champion" && !dim && <Crown rim={`url(#${id}r)`} ink={ink} />}
    </svg>
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
        <g stroke={ink} strokeWidth="2.2" strokeLinejoin="round">
          <path d="M14 98 L84 8 L88 11 L19 101 Z" fill={wood} />
          <path d="M86 98 L16 8 L12 11 L81 101 Z" fill={wood} />
          <path d="M84 8 L92 2 L88 11 Z" fill={rim} />
          <path d="M16 8 L8 2 L12 11 Z" fill={rim} />
        </g>
      );
    case "pennant":
      return (
        <g stroke={ink} strokeWidth="2.2" strokeLinejoin="round">
          <path d="M14 98 L84 8 L88 11 L19 101 Z" fill={wood} />
          <path d="M86 98 L16 8 L12 11 L81 101 Z" fill={wood} />
          <path d="M84 9 L99 13 L90 18 L98 24 L80 20 Z" fill={cloth} />
          <path d="M16 9 L1 13 L10 18 L2 24 L20 20 Z" fill={cloth} />
        </g>
      );
    case "batons":
      return (
        <g stroke={ink} strokeWidth="2.2" strokeLinejoin="round">
          <path d="M10 92 L82 12 L88 17 L16 97 Z" fill={dim ? cloth : toyMatters.blue.bottom} />
          <path d="M90 92 L18 12 L12 17 L84 97 Z" fill={dim ? cloth : toyMatters.blue.bottom} />
          <circle cx="85" cy="14" r="5" fill={rim} />
          <circle cx="15" cy="14" r="5" fill={rim} />
          <circle cx="13" cy="95" r="5" fill={rim} />
          <circle cx="87" cy="95" r="5" fill={rim} />
        </g>
      );
    case "sword":
      return (
        <g stroke={ink} strokeWidth="2.2" strokeLinejoin="round">
          <path d="M47 4 L50 -2 L53 4 V104 H47 Z" fill={toyMatters.paper.top} />
          <path d="M30 10 H70 V16 H30 Z" fill={rim} />
          <path d="M47 104 H53 V110 H47 Z" fill={rim} />
        </g>
      );
    case "laurels":
      return (
        <g
          stroke={ink}
          strokeWidth="1.8"
          strokeLinejoin="round"
          fill={dim ? cloth : toyMatters.green.top}
        >
          {[0, 1, 2, 3, 4].map((leaf) => (
            <g key={leaf}>
              <ellipse
                cx={18 - leaf * 0.5}
                cy={88 - leaf * 15}
                rx="5"
                ry="10"
                transform={`rotate(${-35 + leaf * 9} ${18 - leaf * 0.5} ${88 - leaf * 15})`}
              />
              <ellipse
                cx={82 + leaf * 0.5}
                cy={88 - leaf * 15}
                rx="5"
                ry="10"
                transform={`rotate(${35 - leaf * 9} ${82 + leaf * 0.5} ${88 - leaf * 15})`}
              />
            </g>
          ))}
        </g>
      );
  }
}

function Crown({ rim, ink }: { readonly rim: string; readonly ink: string }) {
  return (
    <g stroke={ink} strokeWidth="2.4" strokeLinejoin="round">
      <path d="M30 18 L33 2 L42 11 L50 -1 L58 11 L67 2 L70 18 Z" fill={rim} />
      <circle cx="50" cy="8" r="3" fill={toyMatters.red.top} strokeWidth="1.5" />
    </g>
  );
}
