import { slugSchema } from "@leximon/contract";
import { CARD_NOT_FOUND, cardPagePitch, cardPageTitle } from "@leximon/view-model";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { type PublicCard, readCatalogCard } from "@/cards/catalog-server";
import { PublicCardView } from "@/cards/public-card";
import styles from "@/cards/public-card.module.css";
import { ButtonLink } from "@/ui/button";
import { Logo } from "@/ui/logo";

async function cardOf(params: Promise<{ id: string }>): Promise<PublicCard | null> {
  const id = slugSchema.safeParse((await params).id);
  return id.success ? readCatalogCard(id.data) : null;
}

export async function generateMetadata({ params }: PageProps<"/carte/[id]">): Promise<Metadata> {
  const found = await cardOf(params).catch(() => null);
  if (found === null) return { title: "Carte introuvable · Leximon", robots: { index: false } };
  return {
    title: cardPageTitle(found.card.word),
    description: found.card.definition,
    robots: { index: false },
  };
}

/** A card's public page, the one a shared card leads to. */
export default function CardPage(props: PageProps<"/carte/[id]">) {
  return (
    <div className={styles.page}>
      <Link href="/" aria-label="Leximon, l'accueil" className={styles.back}>
        <Logo size="md" />
      </Link>
      <Suspense fallback={null}>
        <CardContent params={props.params} />
      </Suspense>
    </div>
  );
}

async function CardContent({ params }: Pick<PageProps<"/carte/[id]">, "params">) {
  let found: PublicCard | null;
  try {
    found = await cardOf(params);
  } catch {
    return <p className={styles.missing}>Le serveur lambine. Recharge la page.</p>;
  }
  if (found === null) {
    return (
      <div className={styles.missing}>
        <span>{CARD_NOT_FOUND}</span>
        <ButtonLink href="/jouer" small>
          Jouer à Leximon
        </ButtonLink>
      </div>
    );
  }
  return (
    <PublicCardView
      card={found.card}
      collectionName={found.collectionName}
      pitch={cardPagePitch(found.catalogSize)}
    />
  );
}
