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

const SITE = "https://leximon.fr";

async function cardOf(params: Promise<{ id: string }>): Promise<PublicCard | null> {
  const id = slugSchema.safeParse((await params).id);
  return id.success ? readCatalogCard(id.data) : null;
}

export async function generateMetadata({ params }: PageProps<"/carte/[id]">): Promise<Metadata> {
  let found: PublicCard | null;
  try {
    found = await cardOf(params);
  } catch {
    // The catalogue did not answer: the card may well exist, so no noindex that would drop it.
    return {};
  }
  if (found === null) return { title: "Carte introuvable · Leximon", robots: { index: false } };
  return {
    title: cardPageTitle(found.card.word),
    description: found.card.definition,
    alternates: { canonical: `/carte/${found.card.id}` },
    openGraph: {
      type: "article",
      url: `/carte/${found.card.id}`,
      siteName: "Leximon",
      locale: "fr_FR",
      title: cardPageTitle(found.card.word),
      description: found.card.definition,
    },
  };
}

/**
 * The word as a dictionary entry, for search engines. `<` is escaped so no text of the catalogue
 * can close the script element.
 */
function definedTermJson({ card, collectionName }: PublicCard): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": "DefinedTerm",
    name: card.word,
    description: card.definition,
    inLanguage: "fr",
    url: `${SITE}/carte/${card.id}`,
    inDefinedTermSet: { "@type": "DefinedTermSet", name: `Leximon, ${collectionName}`, url: SITE },
  }).replaceAll("<", "\\u003c");
}

/** A card's public page, the one a shared card leads to. */
export default function CardPage(props: PageProps<"/carte/[id]">) {
  return (
    <div className={styles.page}>
      <Link href="/" aria-label="Accueil de Leximon" className={styles.back}>
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
    return <p className={styles.missing}>Le serveur ne répond pas. Recharge la page.</p>;
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
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: catalogue data, escaped below
        dangerouslySetInnerHTML={{ __html: definedTermJson(found) }}
      />
      <PublicCardView
        card={found.card}
        collectionName={found.collectionName}
        seal={found.seal}
        pitch={cardPagePitch(found.catalogSize)}
        neighbours={found.neighbours}
      />
    </>
  );
}
