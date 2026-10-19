"""Card rarity from the Ngram frequency and the "pépite" mark (D-020, docs/rnd/rarete.md)."""

import math
from dataclasses import dataclass
from datetime import date

from .ngram import NgramFrequency

#: Same identifiers as `packages/core`, French labels as in `packages/contract`.
LABELS = {
    "common": "Courant",
    "uncommon": "Peu courant",
    "rare": "Rare",
    "precious": "Précieux",
    "epic": "Épique",
    "legendary": "Légendaire",
}
#: Added to frequencies (per billion words) so that an absent word has a finite score.
FLOOR = 0.01


@dataclass(frozen=True)
class RarityRule:
    """Score thresholds in force from `starts_on`. A rule never changes once published: a new
    calibration is a new rule, and published cards keep their rarity anyway."""

    starts_on: date
    uncommon_from: float
    rare_from: float
    precious_from: float


RULES = (
    # Provisional: quantiles 40 / 25 / 17 % of the spike's plausible catalogue. To recalibrate on
    # the launch catalogue, then freeze.
    RarityRule(date(2026, 10, 19), uncommon_from=-1.35, rare_from=-0.59, precious_from=0.08),
)


def score(frequency: NgramFrequency) -> float:
    """Higher is rarer: minus the log frequency, two thirds today and one third in the 1800s."""
    modern = math.log10(frequency.modern + FLOOR)
    littre_era = math.log10(frequency.littre_era + FLOOR)
    return -(2 * modern + littre_era) / 3


def rule_on(day: date) -> RarityRule:
    in_force = [rule for rule in RULES if rule.starts_on <= day]
    if not in_force:
        raise ValueError(f"no rarity rule in force on {day}")
    return max(in_force, key=lambda rule: rule.starts_on)


def can_be_pepite(frequency: NgramFrequency, rule: RarityRule) -> bool:
    return score(frequency) >= rule.precious_from


def rarity(frequency: NgramFrequency | None, pepite: bool, rule: RarityRule) -> str | None:
    """None when the frequency is unknown (compounds): the rarity stays to be completed."""
    if frequency is None:
        return None
    value = score(frequency)
    if value < rule.uncommon_from:
        return "common"
    if value < rule.rare_from:
        return "uncommon"
    if value < rule.precious_from:
        return "rare"
    if not pepite:
        return "precious"
    # Below Précieux, Ngram's 40-occurrence threshold leaves no frequency to rank by: the rarest
    # pépites are those absent from the whole corpus.
    return "epic" if frequency.attested else "legendary"


def frequency_label(frequency: NgramFrequency | None) -> str:
    """The figure shown on the card (P22): occurrences per billion words since 1990."""
    if frequency is None:
        return "inconnue (mot composé)"
    if frequency.modern == 0:
        return "< 1 par milliard"
    if frequency.modern < 10:
        return f"{frequency.modern:.2g} par milliard".replace(".", ",")
    return f"{round(frequency.modern):,} par milliard".replace(",", " ")
