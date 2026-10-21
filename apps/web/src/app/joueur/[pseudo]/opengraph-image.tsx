import { colors, fonts } from "@leximon/tokens";
import { formatCount, plural, profileHeadline } from "@leximon/view-model";
import { ImageResponse } from "next/og";
import { googleFont } from "@/lib/og-fonts";
import { readPublicProfile } from "@/profile/public-profile-data";

export const alt = "Profil d'un joueur de Leximon";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DOMAIN = "leximon.fr";

/**
 * The image of a shared profile (P-05): pseudo, title, level, the figures. Drawn on demand by
 * Next, from the same cached copy as the page; nothing goes through the queue.
 */
export default async function Image({ params }: { params: Promise<{ pseudo: string }> }) {
  const raw = (await params).pseudo;
  let pseudo = raw;
  try {
    pseudo = decodeURIComponent(raw);
  } catch {
    // A malformed escape: the raw segment is the pseudo looked up.
  }
  const profile = await readPublicProfile(pseudo).catch(() => null);
  const name = profile?.pseudo ?? "Leximon";
  const headline =
    profile?.visibility === "public" ? profileHeadline(profile.title, profile.level) : "";
  const figures =
    profile?.visibility === "public"
      ? [
          `${formatCount(profile.stats.words)} mots`,
          plural(profile.stats.legendaries, "Légendaire", "Légendaires"),
          plural(profile.stats.tradesCompleted, "échange", "échanges"),
        ].join(" · ")
      : "";
  const initial = name.slice(0, 1).toUpperCase();

  const [display, ui] = await Promise.all([
    googleFont(
      `${fonts.display.family}:opsz,wght,SOFT@72,${fonts.display.weight},${fonts.display.soft}`,
      `Leximon${name}${initial}`,
    ),
    googleFont(`${fonts.ui.family}:wght@800`, DOMAIN + headline + figures),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "56px 72px",
        backgroundColor: colors.background,
        backgroundImage: "linear-gradient(110deg, #5E2130 0%, #2C3459 55%, #262B40 100%)",
        color: colors.text,
      }}
    >
      <div style={{ fontFamily: "Display", fontSize: 44 }}>Leximon</div>
      <div style={{ display: "flex", alignItems: "center", gap: 48 }}>
        <div
          style={{
            width: 220,
            height: 220,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 110,
            backgroundColor: "#FBF5E8",
            color: colors.kraftTitle,
            border: `10px solid ${colors.accent}`,
            fontFamily: "Display",
            fontSize: 120,
          }}
        >
          {initial}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
          <div style={{ fontFamily: "Display", fontSize: 92, lineHeight: 1 }}>{name}</div>
          {headline !== "" && (
            <div style={{ fontFamily: "Ui", fontSize: 34, color: colors.accent }}>{headline}</div>
          )}
          {figures !== "" && (
            <div style={{ fontFamily: "Ui", fontSize: 28, color: colors.textMuted }}>{figures}</div>
          )}
        </div>
      </div>
      <div style={{ fontFamily: "Ui", fontSize: 24, color: colors.textMuted }}>{DOMAIN}</div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Display", data: display, weight: fonts.display.weight, style: "normal" },
        { name: "Ui", data: ui, weight: 800, style: "normal" },
      ],
    },
  );
}
