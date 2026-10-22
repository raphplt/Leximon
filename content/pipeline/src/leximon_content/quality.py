"""Automatic editorial decisions, computed from recorded data only (drafts, verifications, charm
scores): which drafts are dropped, which cards are pépites, which go to human review."""

import random
from collections.abc import Iterable
from dataclasses import dataclass

from .drafting import CardDraft

#: Shares of the catalogue (docs/rnd/collection-sim.md). Légendaire is a pépite absent from the
#: whole Ngram corpus, Épique any other pépite: each takes its own top charm scores.
EPIC_SHARE = 0.06
LEGENDARY_SHARE = 0.02
#: Below this mean charm score (out of 10), a word is never a pépite, even if its quota is not
#: filled: an Épique or a Légendaire must be a word one is glad to draw (6 = "plaisant").
MIN_PEPITE_CHARM = 6.0
#: Share of the cards a human reads at random, on top of every Légendaire and every flagged card.
REVIEW_SHARE = 0.05

REVIEW_REASONS = {
    "sample": "échantillon",
    "legendary": "légendaire",
    "faithfulness": "fidélité",
    "checks": "contrôle automatique",
    "unverified": "non vérifiée",
}


@dataclass(frozen=True)
class Decision:
    """What the quality steps decided for a card, as shown in Directus."""

    pepite: bool
    charm: float | None
    faithfulness: str
    review_reasons: list[str]


def is_kept(draft: CardDraft) -> bool:
    """The drafting model's opinion is final: anything but "ok" never reaches Directus."""
    return draft.suitability == "ok"


@dataclass(frozen=True)
class PepiteCandidate:
    word: str
    charm: float
    #: False when the word is absent from the whole Ngram corpus: a Légendaire if a pépite.
    attested: bool


def quota(share: float, catalogue_size: int) -> int:
    return round(share * catalogue_size)


def pick_pepites(candidates: Iterable[PepiteCandidate], catalogue_size: int) -> set[str]:
    """The best charm scores, Légendaire and Épique filled separately so that the batch follows
    the pyramid at most. Ties go to alphabetical order, so the result never depends on input
    order."""
    charming = (c for c in candidates if c.charm >= MIN_PEPITE_CHARM)
    ranked = sorted(charming, key=lambda c: (-c.charm, c.word))
    legendary = [c.word for c in ranked if not c.attested]
    epic = [c.word for c in ranked if c.attested]
    return {
        *legendary[: quota(LEGENDARY_SHARE, catalogue_size)],
        *epic[: quota(EPIC_SHARE, catalogue_size)],
    }


def review_reasons(
    words: Iterable[str],
    flags: dict[str, list[str]],
    legendary: set[str],
    seed: str,
) -> dict[str, list[str]]:
    """Why each card goes to human review; cards absent from the result are published as is.
    The random sample is drawn among the cards that nothing else sends to review, so that it
    measures the quality of what is published unread."""
    words = sorted(words)
    reasons: dict[str, list[str]] = {}
    for word in words:
        mine = list(flags.get(word, []))
        if word in legendary:
            mine.append("legendary")
        if mine:
            reasons[word] = mine
    unread = [word for word in words if word not in reasons]
    sample_size = min(len(unread), max(1, quota(REVIEW_SHARE, len(words)))) if words else 0
    for word in random.Random(seed).sample(unread, sample_size):
        reasons[word] = ["sample"]
    return reasons
