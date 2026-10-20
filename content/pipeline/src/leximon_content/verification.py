"""Faithfulness check: a second model (Opus, not the drafting model) reads each draft against its
Littré entry and flags what the entry does not support. A flagged card goes to human review."""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import anthropic
from pydantic import BaseModel, ValidationError

from . import littre, llm
from .drafting import CardDraft

MODEL = "claude-opus-5-5"
FIELDS = ("definition", "etymology", "quote_author", "part_of_speech")

#: Kinds of problem. Only the first two fail the card: an exact addition is a fact the entry
#: does not give but that the verifier knows to be well established (pagure, bernard-l'ermite).
KINDS = ("contredit", "invente", "ajout_exact")
FAILING_KINDS = ("contredit", "invente")

SYSTEM_PROMPT = """Tu vérifies les cartes de Leximon, un jeu de cartes sur les mots rares et anciens du français. Chaque carte a été rédigée par un autre modèle à partir de l'entrée du dictionnaire de Littré (1863). On te donne l'entrée, puis la carte. Le but : qu'aucune carte publiée n'affirme une chose fausse.

Relève chaque affirmation de la carte que l'entrée ne permet pas d'écrire, et classe-la :
- contredit : la carte dit le contraire de l'entrée, ou présente comme sûre une origine que le Littré dit incertaine ;
- invente : l'entrée ne le dit pas, et tu ne peux pas affirmer que c'est exact (un sens, une date, un siècle, une langue ou un mot source, un usage, un détail historique) ;
- ajout_exact : l'entrée ne le dit pas, mais c'est un fait bien établi que tu peux garantir (par exemple traduire un mot grec ou latin cité, nommer l'animal qu'un nom savant désigne).

Champs à vérifier :
- definition : le sens, et tout détail ajouté (époque, lieu, usage, valeur) ;
- etymology : langue, mot source, date ;
- quote_author : le nom complet doit correspondre à l'abréviation du Littré (par exemple MOL. est Molière, VOLT. Voltaire, J. J. ROUSS. Jean-Jacques Rousseau) ;
- part_of_speech : la nature grammaticale.

Ne relève pas :
- une reformulation, une simplification, un mot moderne pour dire la même chose ;
- le choix d'un seul des sens de l'entrée ;
- « Origine incertaine. » quand l'entrée n'a pas d'étymologie ou la dit douteuse ;
- une étymologie qui explique la formation du mot à partir du MOT DE BASE PROBABLE, quand il est fourni et que la dérivation est évidente (secrétage, de secréter) ;
- une abréviation d'auteur recopiée telle quelle.

faithful vaut false dès qu'un problème est contredit ou invente. Pour chaque problème, dis en une phrase ce qu'affirme la carte et ce que dit l'entrée. Sois juste : un faux signalement coûte une relecture inutile, un signalement manqué publie une erreur."""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "faithful": {"type": "boolean"},
        "problems": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "field": {"type": "string", "enum": list(FIELDS)},
                    "kind": {"type": "string", "enum": list(KINDS)},
                    "issue": {"type": "string"},
                },
                "required": ["field", "kind", "issue"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["faithful", "problems"],
    "additionalProperties": False,
}


class Problem(BaseModel):
    field: Literal[FIELDS]  # type: ignore[valid-type]
    kind: Literal[KINDS]  # type: ignore[valid-type]
    issue: str

    @property
    def fails(self) -> bool:
        return self.kind in FAILING_KINDS


class Verdict(BaseModel):
    faithful: bool
    problems: list[Problem]


@dataclass(frozen=True)
class Verification:
    word: str
    #: Which draft of the word was checked: 0 for the first, then one per correction.
    attempt: int
    verdict: Verdict | None
    error: str | None
    cost_usd: float

    def to_json(self) -> dict[str, object]:
        return {
            "word": self.word,
            "attempt": self.attempt,
            "model": MODEL,
            "verdict": self.verdict.model_dump() if self.verdict else None,
            "error": self.error,
            "cost_usd": round(self.cost_usd, 6),
        }


def card_text(draft: CardDraft, entry: littre.Entry) -> str:
    lines = [
        f"MOT : {entry.headword}",
        f"part_of_speech : {draft.part_of_speech}",
        f"definition : {draft.definition}",
        f"etymology : {draft.etymology}",
    ]
    citations = entry.citations[:12]
    if draft.quote_index and 1 <= draft.quote_index <= len(citations):
        quote = citations[draft.quote_index - 1]
        lines.append(f"citation : « {quote.text} » ({quote.author or '?'}, {quote.reference})")
        lines.append(f"quote_author : {draft.quote_author}")
    return "\n".join(lines)


def prompt(draft: CardDraft, entry: littre.Entry, base: littre.Entry | None = None) -> str:
    return (
        f"ENTRÉE DU LITTRÉ\n\n{littre.render(entry, base=base)}\n\n"
        f"CARTE À VÉRIFIER\n\n{card_text(draft, entry)}"
    )


async def verify(
    api: anthropic.AsyncAnthropic,
    draft: CardDraft,
    entry: littre.Entry,
    attempt: int = 0,
    base: littre.Entry | None = None,
) -> Verification:
    answer = await llm.ask_json(
        api, MODEL, SYSTEM_PROMPT, prompt(draft, entry, base), OUTPUT_SCHEMA, effort="medium"
    )
    word = entry.headword.lower()
    if answer.error:
        return Verification(word, attempt, None, answer.error, answer.cost_usd)
    try:
        verdict = Verdict.model_validate(answer.data)
    except ValidationError as error:
        return Verification(word, attempt, None, f"invalid output: {error}", answer.cost_usd)
    # The kinds decide, whatever the flag says.
    verdict = Verdict(
        faithful=not any(p.fails for p in verdict.problems), problems=verdict.problems
    )
    return Verification(word, attempt, verdict, None, answer.cost_usd)


def summary(verdict: Verdict) -> str:
    lines = [
        f"{'✗' if p.fails else '○'} {p.field} ({p.kind}) — {p.issue}" for p in verdict.problems
    ]
    return "\n".join(["✓ fidèle au Littré" if verdict.faithful else "✗ à vérifier", *lines])


def load(path: Path) -> dict[tuple[str, int], dict[str, object]]:
    """Successful verifications by word and draft attempt (the latest one wins)."""
    if not path.exists():
        return {}
    rows = (json.loads(line) for line in path.read_text(encoding="utf-8").splitlines())
    return {(row["word"], row.get("attempt", 0)): row for row in rows if row["verdict"]}


def failing_problems(row: dict[str, object]) -> list[str]:
    """The problems of a recorded verdict that fail the card, as sent back to the drafter."""
    verdict = Verdict.model_validate(row["verdict"])
    return [f"{p.field} : {p.issue}" for p in verdict.problems if p.fails]
