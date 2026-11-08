import { PLAIN_BANNER, profileHeadline } from "@leximon/view-model";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileBanner } from "@/components/profile-banner";
import styles from "@/profile/profile.module.css";
import { PlayerPageFrame, PublicProfileScreen } from "@/profile/public-profile";
import { readPublicProfile } from "@/profile/public-profile-data";

function pseudoOf(param: string): string {
  try {
    return decodeURIComponent(param);
  } catch {
    return param;
  }
}

export async function generateMetadata({
  params,
}: PageProps<"/joueur/[pseudo]">): Promise<Metadata> {
  const pseudo = pseudoOf((await params).pseudo);
  const profile = await readPublicProfile(pseudo).catch(() => null);
  if (profile === null) return { title: "Joueur introuvable · Leximon", robots: { index: false } };
  const description =
    profile.visibility === "public"
      ? `${profileHeadline(profile.title, profile.level)}. ${profile.stats.words} mots rares dans son album.`
      : "Un joueur de Leximon.";
  return {
    title: `${profile.pseudo} · Leximon`,
    description,
    robots: { index: false },
  };
}

/** Someone's public profile, the page a shared link leads to. */
export default function PlayerPage(props: PageProps<"/joueur/[pseudo]">) {
  return (
    <Suspense
      fallback={
        <PlayerPageFrame signedIn={false}>
          <div className={styles.banner}>
            <ProfileBanner banner={PLAIN_BANNER} className={styles.bannerArt} />
          </div>
        </PlayerPageFrame>
      }
    >
      <PlayerProfile params={props.params} />
    </Suspense>
  );
}

async function PlayerProfile({ params }: Pick<PageProps<"/joueur/[pseudo]">, "params">) {
  const pseudo = pseudoOf((await params).pseudo);
  try {
    return <PublicProfileScreen pseudo={pseudo} initial={await readPublicProfile(pseudo)} />;
  } catch {
    return (
      <PlayerPageFrame signedIn={false}>
        <p className={styles.note}>Le serveur ne répond pas. Recharge la page.</p>
      </PlayerPageFrame>
    );
  }
}
