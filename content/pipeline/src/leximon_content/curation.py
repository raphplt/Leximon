"""The quality steps of a run, between drafting and Directus: drop unsuitable drafts, verify
faithfulness, judge charm, then decide pépites and the review queue (quality.py).

Each step records its results in the run's directory, one line per item as it arrives: a step
run twice only pays for what is missing, and every decision is computed again from the files."""

import json
import random
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import anthropic

from . import charm, checks, config, drafting, littre, llm, ngram, prescreen, quality, verification
from .drafting import CardDraft
from .quality import Decision
from .rarity import LABELS, can_be_pepite, rarity, rule_on

#: Above this estimate (USD), a step waits for `--yes`: the owner approves larger spending.
MAX_UNCONFIRMED_USD = 3.0
#: Cost estimates before a first measurement, from the lot-1 trial.
ESTIMATED_VERIFY_USD = 0.012
ESTIMATED_JUDGE_BATCH_USD = 0.03
ESTIMATED_PRESCREEN_USD = 0.0001
ESTIMATED_REDRAFT_USD = 0.006
#: A card the verifier still flags after this many corrections goes to human review.
MAX_CORRECTIONS = 1


def run_dir(name: str) -> Path:
    path = config.RUNS_DIR / name
    path.mkdir(parents=True, exist_ok=True)
    return path


def confirm_spend(what: str, estimate: float, yes: bool) -> None:
    print(f"{what} : environ {estimate:.2f} $")
    if estimate > MAX_UNCONFIRMED_USD and not yes:
        raise SystemExit(
            f"Plus de {MAX_UNCONFIRMED_USD:.0f} $ : relancer avec --yes après accord du propriétaire."
        )


def _jsonl(path: Path) -> list[dict[str, object]]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def _append(path: Path):
    file = path.open("a", encoding="utf-8")

    def write(row: dict[str, object]) -> None:
        file.write(json.dumps(row, ensure_ascii=False) + "\n")
        file.flush()

    return file, write


@dataclass(frozen=True)
class Draft:
    """The current draft of a word: the first one, or its latest correction."""

    result: dict[str, object]
    draft: CardDraft
    entry: littre.Entry
    selected: dict[str, object]
    attempt: int
    #: Cost of the first draft, and of the corrections that followed.
    first_cost: float
    correction_cost: float

    @property
    def word(self) -> str:
        return str(self.result["word"])


def load_drafts(run: str) -> list[Draft]:
    index = littre.index()
    directory = run_dir(run)
    selected = {
        row["word"]: row
        for row in json.loads((directory / "selection.json").read_text(encoding="utf-8"))
    }
    corrections: dict[str, list[dict[str, object]]] = {}
    for row in _jsonl(directory / "redrafts.jsonl"):
        corrections.setdefault(str(row["word"]), []).append(row)
    drafts = []
    for first in _jsonl(directory / "drafts.jsonl"):
        if first["draft"] is None:
            continue
        word = str(first["word"])
        later = sorted(corrections.get(word, []), key=lambda r: int(r["attempt"]))  # type: ignore[arg-type]
        current = next((r for r in reversed(later) if r["draft"] is not None), first)
        drafts.append(
            Draft(
                current,
                CardDraft.model_validate(current["draft"]),
                index[word][0],
                selected[word],
                attempt=int(current.get("attempt", 0)),  # type: ignore[arg-type]
                first_cost=float(first["cost_usd"]),  # type: ignore[arg-type]
                correction_cost=sum(float(r["cost_usd"]) for r in later),  # type: ignore[arg-type]
            )
        )
    return drafts


def verdict_of(
    d: Draft, verified: dict[tuple[str, int], dict[str, object]]
) -> dict[str, object] | None:
    """The verification of the word's current draft, if done."""
    return verified.get((d.word, d.attempt))


def kept(drafts: list[Draft]) -> list[Draft]:
    return [d for d in drafts if quality.is_kept(d.draft)]


# --- Steps that call a model --------------------------------------------------------------------


async def verify_run(run: str, yes: bool) -> None:
    path = run_dir(run) / "verification.jsonl"
    done = verification.load(path)
    todo = [d for d in kept(load_drafts(run)) if verdict_of(d, done) is None]
    if not todo:
        print("vérification : déjà faite")
        return
    measured = [float(r["cost_usd"]) for r in done.values()]  # type: ignore[arg-type]
    per_card = sum(measured) / len(measured) if measured else ESTIMATED_VERIFY_USD
    confirm_spend(
        f"vérification de {len(todo)} cartes ({verification.MODEL})", per_card * len(todo), yes
    )
    file, write = _append(path)
    async with llm.client() as api:
        with file:
            await llm.for_each(
                todo,
                lambda d: verification.verify(api, d.draft, d.entry, d.attempt),
                lambda v: write(v.to_json()),
            )


async def correct_run(run: str, yes: bool) -> None:
    """Sends each card flagged by the verifier or holding English words back to the drafter
    with its problems, once."""
    directory = run_dir(run)
    verified = verification.load(directory / "verification.jsonl")
    todo = []
    for d in kept(load_drafts(run)):
        if d.attempt >= MAX_CORRECTIONS:
            continue
        row = verdict_of(d, verified)
        problems = checks.english_problems(d.draft)
        if row and not row["verdict"]["faithful"]:  # type: ignore[index]
            problems = verification.failing_problems(row) + problems
        if problems:
            todo.append((d, problems))
    if not todo:
        print("correction : rien à corriger")
        return
    confirm_spend(
        f"correction de {len(todo)} cartes ({drafting.MODEL})",
        ESTIMATED_REDRAFT_USD * len(todo),
        yes,
    )

    async def correct(item: tuple[Draft, list[str]]) -> dict[str, object]:
        d, problems = item
        try:
            result = await drafting.draft_card(api, drafting.MODEL, d.entry, (d.draft, problems))
            row = result.to_json()
        except anthropic.APIError as error:
            row = {"word": d.word, "model": drafting.MODEL, "draft": None, "error": repr(error)}
            row["cost_usd"] = 0.0
        return {**row, "attempt": d.attempt + 1, "problems": problems}

    file, write = _append(directory / "redrafts.jsonl")
    async with llm.client() as api:
        with file:
            await llm.for_each(todo, correct, write)


def pepite_eligible(
    drafts: list[Draft], verified: dict[tuple[str, int], dict[str, object]]
) -> list[Draft]:
    """Kept, verified faithful, and rare enough to be Épique or Légendaire."""
    rule = rule_on(date.today())
    eligible = []
    for d in kept(drafts):
        frequency = ngram.frequency(d.word)
        row = verdict_of(d, verified)
        faithful = bool(row and row["verdict"]["faithful"])  # type: ignore[index]
        if faithful and frequency is not None and can_be_pepite(frequency, rule):
            eligible.append(d)
    return eligible


def judge_card(d: Draft) -> charm.Card:
    citations = d.entry.citations[:12]
    index = d.draft.quote_index
    quote = citations[index - 1].text if index and 1 <= index <= len(citations) else None
    return charm.Card(d.word, d.draft.part_of_speech, d.draft.definition, d.draft.etymology, quote)


async def judge_run(run: str, yes: bool) -> None:
    """Judges the eligible words not yet judged in every round. A handful of new words (after a
    correction) is padded with words already judged, so that it is still a comparison."""
    path = run_dir(run) / "charm.jsonl"
    drafts = load_drafts(run)
    eligible = {
        d.word: d
        for d in pepite_eligible(drafts, verification.load(run_dir(run) / "verification.jsonl"))
    }
    judged = Counter(w for j in charm.load(path) for w in j["scores"])  # type: ignore[attr-defined]
    missing = sorted(w for w in eligible if judged[w] < charm.ROUNDS)
    if not missing:
        print("jury des pépites : déjà fait")
        return
    others = sorted(w for w in eligible if w not in missing)
    padding = random.Random(f"{run}-{len(judged)}").sample(
        others, min(len(others), max(0, charm.BATCH_SIZE - len(missing)))
    )
    todo = charm.batches(missing + padding, seed=f"{run}-{len(judged)}")
    confirm_spend(
        f"jury des pépites, {len(todo)} lots ({charm.MODEL})",
        ESTIMATED_JUDGE_BATCH_USD * len(todo),
        yes,
    )
    file, write = _append(path)
    async with llm.client() as api:
        with file:
            await llm.for_each(
                todo,
                lambda b: charm.judge(api, b[0], [judge_card(eligible[w]) for w in b[1]]),
                lambda j: write(j.to_json()),
            )


async def prescreen_words(words: list[str], yes: bool) -> None:
    index = littre.index()
    done = prescreen.load()
    todo = [index[w][0] for w in words if w not in done and w in index]
    if not todo:
        print("pré-tri : déjà fait")
        return
    measured = [float(r["cost_usd"]) for r in done.values()]  # type: ignore[arg-type]
    per_word = sum(measured) / len(measured) if measured else ESTIMATED_PRESCREEN_USD
    confirm_spend(f"pré-tri de {len(todo)} mots ({prescreen.MODEL})", per_word * len(todo), yes)
    outcomes = await prescreen.screen(todo)
    print(", ".join(f"{k} {v}" for k, v in outcomes.most_common()))


# --- Decisions, from the recorded files only ------------------------------------------------------


@dataclass(frozen=True)
class Card:
    draft: Draft
    automatic: list[checks.Check]
    decision: Decision
    rarity: str | None


@dataclass(frozen=True)
class Curated:
    run: str
    drafts: list[Draft]
    cards: list[Card]
    verified: dict[tuple[str, int], dict[str, object]]
    judgements: list[dict[str, object]]
    eligible: int


def curate(run: str) -> Curated:
    directory = run_dir(run)
    drafts = load_drafts(run)
    verified = verification.load(directory / "verification.jsonl")
    if not verified:
        raise SystemExit(f"Aucune vérification pour {run} : lancer d'abord `quality --run {run}`.")
    judgements = charm.load(directory / "charm.jsonl")
    scores = charm.mean_scores(judgements)
    eligible = pepite_eligible(drafts, verified)
    survivors = kept(drafts)
    pepites = quality.pick_pepites(
        (
            quality.PepiteCandidate(d.word, scores[d.word], ngram.frequency(d.word).attested)  # type: ignore[union-attr]
            for d in eligible
            if d.word in scores
        ),
        catalogue_size=len(survivors),
    )

    rule = rule_on(date.today())
    flags: dict[str, list[str]] = {}
    faithfulness: dict[str, str] = {}
    automatic: dict[str, list[checks.Check]] = {}
    rarities: dict[str, str | None] = {}
    for d in survivors:
        automatic[d.word] = checks.run_checks(d.draft, d.entry)
        row = verdict_of(d, verified)
        mine = []
        if row is None:
            mine.append("unverified")
            faithfulness[d.word] = "non vérifiée"
        else:
            verdict = verification.Verdict.model_validate(row["verdict"])
            faithfulness[d.word] = verification.summary(verdict)
            if d.attempt:
                faithfulness[d.word] += "\n↺ corrigée par le rédacteur, puis revérifiée"
            if not verdict.faithful:
                mine.append("faithfulness")
        if checks.failed(automatic[d.word]):
            mine.append("checks")
        flags[d.word] = mine
        rarities[d.word] = rarity(ngram.frequency(d.word), d.word in pepites, rule)

    legendary = {w for w, r in rarities.items() if r == "legendary"}
    reasons = quality.review_reasons((d.word for d in survivors), flags, legendary, f"{run}-review")
    cards = [
        Card(
            d,
            automatic[d.word],
            Decision(
                pepite=d.word in pepites,
                charm=round(scores[d.word], 2) if d.word in scores else None,
                faithfulness=faithfulness[d.word],
                review_reasons=reasons.get(d.word, []),
            ),
            rarities[d.word],
        )
        for d in survivors
    ]
    return Curated(run, drafts, cards, verified, judgements, len(eligible))


def summary(curated: Curated) -> str:
    drafts, cards = curated.drafts, curated.cards
    rejected = Counter(d.draft.suitability for d in drafts if not quality.is_kept(d.draft))
    flagged = [c for c in cards if "faithfulness" in c.decision.review_reasons]
    problem_fields = Counter(
        p["field"]  # type: ignore[index]
        for c in flagged
        for p in verdict_of(c.draft, curated.verified)["verdict"]["problems"]  # type: ignore[index]
        if p["kind"] in verification.FAILING_KINDS  # type: ignore[index]
    )
    corrected = [c for c in cards if c.draft.attempt > 0]
    fixed = sum("faithfulness" not in c.decision.review_reasons for c in corrected)
    rarities = Counter(c.rarity or "unknown" for c in cards)
    queue = Counter(r for c in cards for r in c.decision.review_reasons)
    to_review = sum(bool(c.decision.review_reasons) for c in cards)
    pepites = sorted(
        (c for c in cards if c.decision.pepite), key=lambda c: -(c.decision.charm or 0)
    )
    n = len(cards)

    draft_cost = sum(d.first_cost for d in drafts)
    correction_cost = sum(d.correction_cost for d in drafts)
    verify_cost = sum(float(r["cost_usd"]) for r in curated.verified.values())  # type: ignore[arg-type]
    judge_cost = sum(float(j["cost_usd"]) for j in curated.judgements)  # type: ignore[arg-type]
    after_drafting = verify_cost + correction_cost + judge_cost
    per_card = (draft_cost + after_drafting) / n if n else 0.0

    lines = [
        f"Run {curated.run} : {len(drafts)} brouillons, {n} cartes gardées ({n / len(drafts):.0%})",
        "  écartés par l'avis du modèle : "
        + ", ".join(f"{k} {v}" for k, v in rejected.most_common()),
        f"  corrigées par le rédacteur puis revérifiées : {len(corrected)}, dont {fixed} "
        "désormais fidèles",
        f"  encore signalées par la vérification : {len(flagged)} ("
        + ", ".join(f"{k} {v}" for k, v in problem_fields.most_common())
        + ")",
        f"  pépites : {len(pepites)} parmi {curated.eligible} candidates jugées "
        f"(quotas {quality.quota(quality.LEGENDARY_SHARE, n)} Légendaires, "
        f"{quality.quota(quality.EPIC_SHARE, n)} Épiques, note minimale "
        f"{quality.MIN_PEPITE_CHARM:g})",
        *(
            f"    {c.draft.word} ({LABELS[c.rarity] if c.rarity else '?'}, {c.decision.charm:.1f})"
            for c in pepites
        ),
        "  raretés : "
        + ", ".join(
            f"{LABELS.get(k, k)} {rarities[k]}" for k in [*LABELS, "unknown"] if rarities[k]
        ),
        f"  à relire : {to_review} ({to_review / n:.0%}) — "
        + ", ".join(f"{quality.REVIEW_REASONS[k]} {v}" for k, v in queue.most_common()),
        f"  coût : rédaction {draft_cost:.2f} $, vérification {verify_cost:.2f} $, "
        f"correction {correction_cost:.2f} $, jury {judge_cost:.2f} $",
        f"  coût pour 1 000 cartes gardées : {per_card * 1000:.2f} $ sans pré-tri",
    ]
    lines += prescreen_lines(curated, after_drafting)
    return "\n".join(lines)


def prescreen_lines(curated: Curated, after_drafting_cost: float) -> list[str]:
    """Agreement of the pre-screen with the drafting model, and what drafting only the words it
    lets through would cost."""
    screened = prescreen.load()
    reference = {d.word: d.draft.suitability for d in curated.drafts}
    predicted = {w: str(screened[w]["suitability"]) for w in reference if w in screened}
    if not predicted:
        return [f"  pré-tri : aucun mot du run pré-trié (`prescreen --run {curated.run}`)"]
    a = prescreen.agreement(predicted, reference)
    if not a.both_ok:
        return [f"  pré-tri : aucun mot gardé parmi les {a.compared} pré-triés"]
    let_through = (a.both_ok + a.only_prescreen_ok) / a.compared
    screen_cost = sum(float(screened[w]["cost_usd"]) for w in predicted) / len(predicted)  # type: ignore[arg-type]
    draft_cost = sum(d.first_cost for d in curated.drafts) / len(curated.drafts)
    n = len(curated.cards)
    # Per kept card: screen 1 / (let_through x precision) words, draft 1 / precision of them.
    with_prescreen = (
        screen_cost / (let_through * a.precision)
        + draft_cost / a.precision
        + after_drafting_cost / n
    )
    return [
        f"  pré-tri ({prescreen.MODEL}) sur {a.compared} mots : laisse passer {let_through:.0%}, "
        f"précision {a.precision:.0%}, rappel {a.recall:.0%}, même catégorie {a.same_category / a.compared:.0%}",
        f"  coût pour 1 000 cartes gardées avec pré-tri : {with_prescreen * 1000:.2f} $",
    ]
