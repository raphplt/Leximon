import type { PublicRiddle } from "@leximon/contract";
import { riddlePublicLine } from "@leximon/view-model";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import styles from "@/riddle/public-riddle.module.css";
import { readPublicRiddle } from "@/riddle/public-riddle-data";
import { ButtonLink } from "@/ui/button";
import { Logo } from "@/ui/logo";
import ui from "@/ui/ui.module.css";

function numberOf(param: string): number | null {
  return /^[1-9]\d{0,4}$/.test(param) ? Number(param) : null;
}

async function riddleOf({
  params,
}: Pick<PageProps<"/enigme/[numero]">, "params">): Promise<PublicRiddle | null> {
  const number = numberOf((await params).numero);
  return number === null ? null : readPublicRiddle(number);
}

export async function generateMetadata(props: PageProps<"/enigme/[numero]">): Promise<Metadata> {
  const riddle = await riddleOf(props).catch(() => null);
  if (riddle === null) return { title: "Énigme introuvable · Leximon", robots: { index: false } };
  return {
    title: `Énigme n° ${riddle.number} · Leximon`,
    description: "Un mot rare du français à deviner, le même pour tout le monde chaque jour.",
    robots: { index: false },
  };
}

/** A riddle's public page, the one a shared result leads to. */
export default function RiddlePublicPage(props: PageProps<"/enigme/[numero]">) {
  return (
    <div className={styles.page}>
      <Link href="/" aria-label="Accueil de Leximon" className={styles.back}>
        <Logo size="md" />
      </Link>
      <Suspense fallback={null}>
        <RiddleContent params={props.params} />
      </Suspense>
    </div>
  );
}

async function RiddleContent({ params }: Pick<PageProps<"/enigme/[numero]">, "params">) {
  let riddle: PublicRiddle | null;
  try {
    riddle = await riddleOf({ params });
  } catch {
    return <p className={styles.line}>Le serveur ne répond pas. Recharge la page.</p>;
  }
  if (riddle === null) {
    return (
      <section className={`${ui.panel} ${styles.panel}`}>
        <p className={styles.line}>Cette énigme n'existe pas.</p>
        <ButtonLink href="/enigme">Jouer l'énigme du jour</ButtonLink>
      </section>
    );
  }
  return (
    <section className={`${ui.panel} ${styles.panel}`}>
      <p className={ui.kicker}>Énigme Leximon n° {riddle.number}</p>
      <h1 className={`${ui.display} ${styles.title}`}>
        {riddle.answer === null
          ? "Sauras-tu trouver le mot du jour ?"
          : `Le mot était « ${riddle.answer.word} ».`}
      </h1>
      <p className={styles.line}>{riddlePublicLine(riddle.played, riddle.found)}</p>
      {riddle.answer !== null && (
        <ButtonLink href={`/carte/${riddle.answer.cardId}`} variant="secondary">
          Voir la carte
        </ButtonLink>
      )}
      <ButtonLink href="/enigme">Jouer l'énigme du jour</ButtonLink>
    </section>
  );
}
