"use client";

import type { CabinetArticle, CabinetCitation, CatalogCabinet } from "@leximon/contract";
import {
  CABINET_ETYMOLOGY_TITLE,
  CABINET_FAMILY_TITLE,
  CABINET_HISTORY_NOTE,
  CABINET_HISTORY_TITLE,
  CABINET_LITTRE_TITLE,
  CABINET_LOCKED,
  CABINET_LOCKED_ACTION,
  CABINET_MISSING,
  CABINET_SOURCES,
  CABINET_TITLE,
  CABINET_USAGE_NOTE,
  CABINET_USAGE_TITLE,
  centuryLabel,
  citationSource,
  familyGroups,
  usageLine,
} from "@leximon/view-model";
import { useRouter } from "next/navigation";
import { editions } from "@/player/player";
import { useShared } from "@/player/resource";
import { useShell } from "@/shell/shell-context";
import { ButtonLink } from "@/ui/button";
import { Icon } from "@/ui/icon";
import { LoadFailed } from "@/ui/load-failed";
import { Tailpiece, TitleRule } from "@/ui/ornaments";
import { ParticleStage } from "@/ui/stage";
import { Leaf, Lettering } from "@/ui/toy";
import ui from "@/ui/ui.module.css";
import styles from "./cabinet-screen.module.css";
import { UsageChart } from "./usage-chart";
import { useCabinet } from "./use-cabinet";

/**
 * The cabinet of a word, for a paying patron: its use in books since 1800, its Littré article and
 * its family. The files are public; this screen is what a patron's subscription opens.
 */
export function CabinetScreen({ cardId }: { readonly cardId: string }) {
  const access = useShared(editions);
  return (
    <ParticleStage dust>
      <main className={styles.page}>
        <BackLink />
        {access === null ? null : access.cabinet ? <Cabinet cardId={cardId} /> : <Locked />}
      </main>
    </ParticleStage>
  );
}

function BackLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={styles.back}
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/album"))}
    >
      <Icon name="back" size={18} />
      Retour
    </button>
  );
}

function Locked() {
  return (
    <Leaf className={`${styles.section} ${styles.door}`}>
      <p className={styles.lead}>{CABINET_LOCKED}</p>
      <ButtonLink href="/mecene" variant="secondary">
        {CABINET_LOCKED_ACTION}
      </ButtonLink>
    </Leaf>
  );
}

function Cabinet({ cardId }: { readonly cardId: string }) {
  const { state, retry } = useCabinet(cardId);
  if (state.kind === "loading") return null;
  if (state.kind === "failed") return <LoadFailed onRetry={retry} />;
  if (state.kind === "missing") return <p className={styles.lead}>{CABINET_MISSING}</p>;
  return <CabinetView cabinet={state.cabinet} />;
}

function CabinetView({ cabinet }: { readonly cabinet: CatalogCabinet }) {
  const groups = familyGroups(cabinet.family);
  const { openCard } = useShell();
  return (
    <>
      <header className={styles.header}>
        <p className={ui.kicker}>{CABINET_TITLE}</p>
        <h1 className={styles.title}>
          <Lettering>{cabinet.word}</Lettering>
        </h1>
      </header>

      <Leaf className={`${styles.section} ${styles.framed}`}>
        <SectionTitle>{CABINET_USAGE_TITLE}</SectionTitle>
        <p className={styles.lead}>{usageLine(cabinet.usage)}</p>
        {cabinet.usage !== null && <UsageChart usage={cabinet.usage} />}
        <p className={styles.note}>{CABINET_USAGE_NOTE}</p>
      </Leaf>

      {cabinet.articles.length > 0 && (
        <Leaf className={`${styles.section} ${styles.framed}`}>
          <SectionTitle>{CABINET_LITTRE_TITLE}</SectionTitle>
          {cabinet.articles.map((article, index) => (
            <Article
              // Homographs keep the Littré's order, which never changes within a file.
              // biome-ignore lint/suspicious/noArrayIndexKey: see above
              key={index}
              word={cabinet.word}
              article={article}
            />
          ))}
        </Leaf>
      )}

      {groups.length > 0 && (
        <Leaf className={`${styles.section} ${styles.framed}`}>
          <SectionTitle>{CABINET_FAMILY_TITLE}</SectionTitle>
          <dl className={styles.family}>
            {groups.map((group) => (
              <div key={group.relation} className={styles.familyRow}>
                <dt>{group.label}</dt>
                <dd>
                  {group.members.map((member) => (
                    <span key={member.word} className={styles.member}>
                      <FamilyWord word={member.word} cardId={member.cardId} onOpen={openCard} />
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </Leaf>
      )}

      <Tailpiece className={styles.tailpiece} />
      <p className={styles.sources}>{CABINET_SOURCES}</p>
    </>
  );
}

function SectionTitle({ children }: { readonly children: string }) {
  return (
    <div className={styles.titled}>
      <h2 className={styles.heading}>{children}</h2>
      <TitleRule />
    </div>
  );
}

function FamilyWord({
  word,
  cardId,
  onOpen,
}: {
  readonly word: string;
  readonly cardId: string | null;
  readonly onOpen: (cardId: string) => void;
}) {
  if (cardId === null) return word;
  return (
    <button type="button" className={styles.memberLink} onClick={() => onOpen(cardId)}>
      {word}
    </button>
  );
}

function Article({ word, article }: { readonly word: string; readonly article: CabinetArticle }) {
  return (
    <article className={styles.article}>
      <p className={styles.entry}>
        <span className={styles.headword}>{word}</span> <em>{article.nature}</em>
      </p>
      <ol className={styles.senses}>
        {article.senses.map((sense, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: senses keep the Littré's order
          <li key={index} className={styles.sense}>
            {sense.number !== null && <span className={styles.number}>{sense.number}°</span>}
            <p className={styles.definition}>{sense.definition}</p>
            <Citations citations={sense.citations} />
          </li>
        ))}
      </ol>
      {article.etymology !== null && (
        <>
          <h3 className={styles.subheading}>{CABINET_ETYMOLOGY_TITLE}</h3>
          <p className={styles.definition}>{article.etymology}</p>
        </>
      )}
      {article.history.length > 0 && (
        <>
          <h3 className={styles.subheading}>{CABINET_HISTORY_TITLE}</h3>
          <p className={styles.note}>{CABINET_HISTORY_NOTE}</p>
          {article.history.map((item) => (
            <div key={item.century} className={styles.century}>
              <p className={styles.centuryName}>{centuryLabel(item.century)}</p>
              <Citations citations={item.citations} />
            </div>
          ))}
        </>
      )}
    </article>
  );
}

function Citations({ citations }: { readonly citations: readonly CabinetCitation[] }) {
  if (citations.length === 0) return null;
  return (
    <ul className={styles.citations}>
      {citations.map((citation) => {
        const source = citationSource(citation);
        return (
          <li key={citation.text}>
            <q className={styles.quote}>{citation.text}</q>
            {source !== "" && <span className={styles.source}>{source}</span>}
          </li>
        );
      })}
    </ul>
  );
}
