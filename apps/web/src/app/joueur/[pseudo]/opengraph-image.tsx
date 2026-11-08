import { bannerSvg, colors, cssFill, fonts, lettering, oldGold, room, toy } from "@leximon/tokens";
import { formatCount, PLAIN_BANNER, plural, profileHeadline } from "@leximon/view-model";
import { ImageResponse } from "next/og";
import type { ReactNode } from "react";
import { googleFont } from "@/lib/og-fonts";
import { lettered, OG_DOMAIN, OG_SIZE, OgBrand, OgRoom } from "@/lib/og-scene";
import { readPublicProfile } from "@/profile/public-profile-data";

export const alt = "Profil d'un joueur de Leximon";
export const size = OG_SIZE;
export const contentType = "image/png";

/**
 * The image of a shared profile: the initial on a gilt medal over the player's banner, then
 * pseudo, title, level, clan and the figures. Drawn on demand by
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
  const clanOf = profile?.visibility === "public" ? profile.clan : null;
  const clan = clanOf === null ? "" : `Clan ${clanOf.name}`;
  const clanLevel = clanOf === null ? "" : String(clanOf.level);
  const figures =
    profile?.visibility === "public"
      ? [
          `${formatCount(profile.stats.words)} mots`,
          plural(profile.stats.legendaries, "Légendaire", "Légendaires"),
          plural(profile.stats.tradesCompleted, "échange", "échanges"),
        ].join(" · ")
      : "";
  const initial = name.slice(0, 1).toUpperCase();
  const banner = profile?.visibility === "public" ? profile.banner : PLAIN_BANNER;

  const [display, ui] = await Promise.all([
    googleFont(
      `${fonts.display.family}:opsz,wght,SOFT@72,${fonts.display.weight},${fonts.display.soft}`,
      `Leximon${name}${initial}`,
    ),
    googleFont(`${fonts.ui.family}:wght@800`, OG_DOMAIN + headline + clan + clanLevel + figures),
  ]);

  return new ImageResponse(
    <OgRoom>
      <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 56, padding: "0 64px" }}>
        <BannerFrame banner={banner}>
          <div
            style={{
              width: 250,
              height: 250,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 125,
              border: `6px solid ${toy.outline}`,
              backgroundImage: cssFill(oldGold),
              boxShadow: `0 18px 30px ${toy.drop}`,
            }}
          >
            <div
              style={{
                width: 210,
                height: 210,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 105,
                border: `4px solid ${toy.outline}`,
                backgroundColor: colors.paper,
                color: colors.paperInk,
                fontFamily: "Display",
                fontSize: 120,
              }}
            >
              {initial}
            </div>
          </div>
        </BannerFrame>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
          <OgBrand size={36} />
          <div style={{ ...lettered(nameSize(name)), lineHeight: 1.05 }}>{name}</div>
          {headline !== "" && (
            <div style={{ fontFamily: "Ui", fontSize: 32, color: lettering.kicker }}>
              {headline}
            </div>
          )}
          {clan !== "" && (
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 46,
                  height: 46,
                  padding: "0 10px",
                  borderRadius: 23,
                  border: `3px solid ${toy.outline}`,
                  backgroundImage: cssFill(oldGold),
                  color: toy.outline,
                  fontFamily: "Ui",
                  fontSize: 24,
                }}
              >
                {clanLevel}
              </div>
              <div style={{ fontFamily: "Ui", fontSize: 30, color: lettering.fill }}>{clan}</div>
            </div>
          )}
          {figures !== "" && (
            <div style={{ fontFamily: "Ui", fontSize: 28, color: lettering.fill }}>{figures}</div>
          )}
          <div style={{ marginTop: 14, fontFamily: "Ui", fontSize: 24, color: lettering.fill }}>
            {OG_DOMAIN}
          </div>
        </div>
      </div>
    </OgRoom>,
    {
      ...size,
      fonts: [
        { name: "Display", data: display, weight: fonts.display.weight, style: "normal" },
        { name: "Ui", data: ui, weight: 800, style: "normal" },
      ],
    },
  );
}

const FRAME = { width: 400, height: 480, padding: 10, border: 4 };

/** The player's banner in a gilt frame, with what it holds in the middle. */
function BannerFrame({
  banner,
  children,
}: {
  readonly banner: { readonly motif: string; readonly tint: string };
  readonly children: ReactNode;
}) {
  const inner = {
    width: FRAME.width - 2 * (FRAME.padding + FRAME.border),
    height: FRAME.height - 2 * (FRAME.padding + FRAME.border),
  };
  const src = `data:image/svg+xml;utf8,${encodeURIComponent(bannerSvg(banner, inner.width, inner.height))}`;
  return (
    <div
      style={{
        width: FRAME.width,
        height: FRAME.height,
        flexShrink: 0,
        display: "flex",
        padding: FRAME.padding,
        borderRadius: room.desk.radius + 6,
        border: `${FRAME.border}px solid ${toy.outline}`,
        backgroundImage: cssFill(oldGold),
        boxShadow: `0 28px 50px ${toy.drop}`,
      }}
    >
      <div
        style={{
          position: "relative",
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          borderRadius: room.desk.radius,
        }}
      >
        {/* biome-ignore lint/performance/noImgElement: drawn by next/og, not served to a browser */}
        <img
          src={src}
          alt=""
          width={inner.width}
          height={inner.height}
          style={{ position: "absolute", top: 0, left: 0 }}
        />
        {children}
      </div>
    </div>
  );
}

/** A pseudo of up to 24 letters fits the column at full size; a longer one shrinks. */
function nameSize(name: string): number {
  return Math.min(84, Math.floor(1300 / Math.max(name.length, 1)));
}
