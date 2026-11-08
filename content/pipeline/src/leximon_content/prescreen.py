"""Cheap pre-screen before drafting: Haiku predicts, from a short Littré excerpt, the opinion
Sonnet would give on the word (`suitability`), so that only promising words get drafted. It also
tags the word's domain, which assigns words to the themed collections.

Predictions are kept in one file for the whole Littré, so a word is never screened twice."""

import json
from collections import Counter
from dataclasses import dataclass

import anthropic

from . import littre, llm
from .config import DATA_DIR
from .drafting import SUITABILITY, SUITABILITY_GUIDE

MODEL = "claude-haiku-5-5"
PRESCREEN_FILE = DATA_DIR / "prescreen.jsonl"
MAX_SENSES = 3
MAX_SENSE_CHARS = 160
MAX_ETYMOLOGY_CHARS = 160
#: Domain of the main sense. The themed collections draw from one or several domains.
DOMAINS = {
    "caractere": "caractère, mœurs, défauts, travers, moqueries et injures, relations entre les gens, sentiments",
    "metiers_objets": "métiers, outils, objets, vêtements, habitat, techniques, commerce et monnaie",
    "betes_plantes": "animaux et plantes : espèces, cris, petits, élevage, chasse, pêche, jardin et culture",
    "nature": "campagne et terrains, eaux, mer, ciel et météo",
    "table": "nourriture, boissons, cuisine, fête et jeux",
    "autre": "tout le reste : idées, discours, droit, religion, temps, lieux…",
}

SYSTEM_PROMPT = (
    """Tu tries des mots pour Leximon, un jeu de cartes à collectionner sur les mots rares et anciens du français. On te donne un court extrait du dictionnaire de Littré (1863) pour un mot. Dis si le mot ferait une bonne carte de collection :
"""
    + SUITABILITY_GUIDE
    + """Un mot encore compris de tous aujourd'hui est trop_courant, même s'il est rare à l'écrit.

Donne aussi le domaine du sens principal (domain) :
"""
    + "".join(f"   - {key} : {description} ;\n" for key, description in DOMAINS.items())
)
OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "suitability": {"type": "string", "enum": list(SUITABILITY)},
        "domain": {"type": "string", "enum": list(DOMAINS)},
    },
    "required": ["suitability", "domain"],
    "additionalProperties": False,
}


def _clip(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


def excerpt(entry: littre.Entry) -> str:
    """The first senses and the etymology, clipped: about a tenth of the drafting prompt."""
    lines = [f"MOT : {entry.headword}", f"NATURE : {entry.nature}"]
    lines += [f"- {_clip(s.definition, MAX_SENSE_CHARS)}" for s in entry.senses[:MAX_SENSES]]
    if len(entry.senses) > MAX_SENSES:
        lines.append(f"(et {len(entry.senses) - MAX_SENSES} autres sens)")
    if entry.etymology:
        lines.append(f"ÉTYMOLOGIE : {_clip(entry.etymology, MAX_ETYMOLOGY_CHARS)}")
    if entry.earliest_century is not None:
        lines.append(f"PREMIÈRE ATTESTATION : {entry.earliest_century}e siècle")
    return "\n".join(lines)


@dataclass(frozen=True)
class Prediction:
    word: str
    suitability: str | None
    domain: str | None
    error: str | None
    cost_usd: float

    def to_json(self) -> dict[str, object]:
        return {
            "word": self.word,
            "model": MODEL,
            "suitability": self.suitability,
            "domain": self.domain,
            "error": self.error,
            "cost_usd": round(self.cost_usd, 7),
            "domains": sorted(DOMAINS),
        }


async def predict(api: anthropic.AsyncAnthropic, entry: littre.Entry) -> Prediction:
    answer = await llm.ask_json(
        api, MODEL, SYSTEM_PROMPT, excerpt(entry), OUTPUT_SCHEMA, effort="low", max_tokens=2000
    )
    word = entry.headword.lower()
    data = answer.data or {}
    value, domain = data.get("suitability"), data.get("domain")
    if answer.error or value not in SUITABILITY or domain not in DOMAINS:
        error = answer.error or f"invalid output: {value!r}, {domain!r}"
        return Prediction(word, None, None, error, answer.cost_usd)
    return Prediction(word, str(value), str(domain), None, answer.cost_usd)


def load() -> dict[str, dict[str, object]]:
    """Successful predictions by word (the latest one wins)."""
    if not PRESCREEN_FILE.exists():
        return {}
    rows = (json.loads(line) for line in PRESCREEN_FILE.read_text(encoding="utf-8").splitlines())
    return {row["word"]: row for row in rows if row["suitability"]}


def outdated_domain(row: dict[str, object]) -> bool:
    """Screened with an older list of domains: its domain may since have been split."""
    return row.get("domains") != sorted(DOMAINS)


async def screen(entries: list[littre.Entry], concurrency: int = 16) -> Counter[str]:
    """Screens the entries and appends each prediction to the file as soon as it arrives."""
    outcomes: Counter[str] = Counter()
    with PRESCREEN_FILE.open("a", encoding="utf-8") as file:

        def keep(prediction: Prediction) -> None:
            file.write(json.dumps(prediction.to_json(), ensure_ascii=False) + "\n")
            file.flush()
            outcomes[prediction.suitability or "erreur"] += 1

        async with llm.client() as api:
            await llm.for_each(entries, lambda e: predict(api, e), keep, concurrency)
    return outcomes


@dataclass(frozen=True)
class Agreement:
    """How the pre-screen's "ok" matches the drafting model's "ok" on the same words."""

    compared: int
    both_ok: int
    only_prescreen_ok: int
    only_reference_ok: int
    same_category: int

    @property
    def precision(self) -> float:
        """Share of the words let through that the drafting model keeps."""
        let_through = self.both_ok + self.only_prescreen_ok
        return self.both_ok / let_through if let_through else 0.0

    @property
    def recall(self) -> float:
        """Share of the words the drafting model keeps that the pre-screen lets through."""
        kept = self.both_ok + self.only_reference_ok
        return self.both_ok / kept if kept else 0.0


def agreement(predicted: dict[str, str], reference: dict[str, str]) -> Agreement:
    words = sorted(predicted.keys() & reference.keys())
    pairs = [(predicted[w] == "ok", reference[w] == "ok") for w in words]
    return Agreement(
        compared=len(words),
        both_ok=sum(p and r for p, r in pairs),
        only_prescreen_ok=sum(p and not r for p, r in pairs),
        only_reference_ok=sum(r and not p for p, r in pairs),
        same_category=sum(predicted[w] == reference[w] for w in words),
    )
