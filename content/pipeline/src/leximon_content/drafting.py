"""Drafts card text from a Littré entry with Claude. The model only rewrites and chooses: the
quote is picked by number from the entry, and the era is computed from the entry's history."""

import asyncio
import json
import time
from dataclasses import dataclass
from typing import Literal

import anthropic
from pydantic import BaseModel, ValidationError

from . import littre

MODELS = ("claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5")

#: USD per million tokens: input, output, cache write, cache read (first-party API rates).
PRICES: dict[str, tuple[float, float, float, float]] = {
    "claude-opus-5-5": (4.00, 20.00, 5.00, 0.20),
    "claude-sonnet-5-5": (2.00, 10.00, 2.50, 0.20),
    "claude-haiku-5-5": (0.10, 0.50, 0.125, 0.01),
}

THEMES = (
    "insultes",
    "loufoque",
    "galanterie",
    "metiers",
    "cuisine",
    "nature",
    "vie-quotidienne",
    "religion",
    "guerre",
    "sentiments",
    "corps",
    "argent",
    "droit",
    "sciences",
    "arts",
    "autre",
)
SUITABILITY = (
    "ok",
    "trop_courant",
    "trop_technique",
    "offensant_aujourdhui",
    "vulgaire",
    "sens_incertain",
)

SYSTEM_PROMPT = """Tu rédiges le texte des cartes de Leximon, un jeu de cartes à collectionner sur les mots rares et anciens du français. On te donne l'entrée du dictionnaire de Littré (1863) pour un mot.

Règles :
1. Appuie-toi uniquement sur l'entrée fournie. N'invente ni sens, ni date, ni étymologie.
2. definition : en français moderne et clair, 25 mots au maximum, une phrase si possible. Reformule avec tes mots, ne recopie pas le Littré. Si le mot a plusieurs sens, garde celui qui fait la meilleure carte (souvent le plus ancien ou le plus pittoresque) ; mentionne au plus un second sens.
3. etymology : 30 mots au maximum, d'après la rubrique ÉTYMOLOGIE. Si elle manque ou si le Littré la dit incertaine, écris « Origine incertaine. »
4. quote_index : le numéro de la citation la plus parlante, de préférence courte (moins de 200 caractères), qui montre le mot en usage. null si aucune ne convient.
5. quote_author : le nom complet de l'auteur de cette citation, à partir de l'abréviation du Littré (par exemple MOL. donne Molière). Si tu n'es pas certain, recopie l'abréviation telle quelle. null si quote_index est null.
6. part_of_speech : la nature abrégée (n. m., n. f., adj., v. tr., v. intr., adv., loc., interj.).
7. themes : un à trois thèmes parmi la liste autorisée.
8. suitability : ton avis sur l'intérêt du mot pour une carte de collection.
   - ok : mot rare ou ancien, avec du charme ou une histoire ;
   - trop_courant : mot encore d'usage courant aujourd'hui dans son sens principal ;
   - trop_technique : vocabulaire scientifique ou technique sans attrait pour le grand public ;
   - offensant_aujourdhui : injure raciste, sexiste, homophobe ou visant un groupe, à écarter ;
   - vulgaire : grossier au point de ne pas convenir à un public adolescent ;
   - sens_incertain : l'entrée ne permet pas de rédiger une carte fiable.
   suitability_reason : une phrase qui justifie ton avis.

Ton : sobre et précis. Le charme vient du mot lui-même, pas d'un commentaire ajouté."""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "definition": {"type": "string"},
        "etymology": {"type": "string"},
        "quote_index": {"anyOf": [{"type": "integer"}, {"type": "null"}]},
        "quote_author": {"anyOf": [{"type": "string"}, {"type": "null"}]},
        "part_of_speech": {"type": "string"},
        "themes": {"type": "array", "items": {"type": "string", "enum": list(THEMES)}},
        "suitability": {"type": "string", "enum": list(SUITABILITY)},
        "suitability_reason": {"type": "string"},
    },
    "required": [
        "definition",
        "etymology",
        "quote_index",
        "quote_author",
        "part_of_speech",
        "themes",
        "suitability",
        "suitability_reason",
    ],
    "additionalProperties": False,
}


class CardDraft(BaseModel):
    definition: str
    etymology: str
    quote_index: int | None
    quote_author: str | None
    part_of_speech: str
    themes: list[Literal[THEMES]]  # type: ignore[valid-type]
    suitability: Literal[SUITABILITY]  # type: ignore[valid-type]
    suitability_reason: str


@dataclass(frozen=True)
class DraftResult:
    word: str
    model: str
    draft: CardDraft | None
    error: str | None
    stop_reason: str | None
    usage: dict[str, int]
    cost_usd: float
    latency_s: float

    def to_json(self) -> dict[str, object]:
        return {
            "word": self.word,
            "model": self.model,
            "draft": self.draft.model_dump() if self.draft else None,
            "error": self.error,
            "stop_reason": self.stop_reason,
            "usage": self.usage,
            "cost_usd": round(self.cost_usd, 6),
            "latency_s": round(self.latency_s, 2),
        }


def cost(model: str, usage: dict[str, int]) -> float:
    price_in, price_out, price_write, price_read = PRICES[model]
    return (
        usage.get("input_tokens", 0) * price_in
        + usage.get("output_tokens", 0) * price_out
        + usage.get("cache_creation_input_tokens", 0) * price_write
        + usage.get("cache_read_input_tokens", 0) * price_read
    ) / 1_000_000


async def draft_card(
    client: anthropic.AsyncAnthropic, model: str, entry: littre.Entry
) -> DraftResult:
    started = time.monotonic()
    response = await client.messages.create(
        model=model,
        max_tokens=8000,
        system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
        messages=[{"role": "user", "content": littre.render(entry) + "\n\nRédige la carte."}],
        output_config={
            "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA},
            "effort": "medium",
        },
    )
    latency = time.monotonic() - started
    usage = {
        key: getattr(response.usage, key) or 0
        for key in (
            "input_tokens",
            "output_tokens",
            "cache_creation_input_tokens",
            "cache_read_input_tokens",
        )
    }
    common = {
        "word": entry.headword.lower(),
        "model": model,
        "stop_reason": response.stop_reason,
        "usage": usage,
        "cost_usd": cost(model, usage),
        "latency_s": latency,
    }
    if response.stop_reason != "end_turn":
        return DraftResult(draft=None, error=f"stop_reason={response.stop_reason}", **common)
    text = next((block.text for block in response.content if block.type == "text"), "")
    try:
        return DraftResult(draft=CardDraft.model_validate(json.loads(text)), error=None, **common)
    except (json.JSONDecodeError, ValidationError) as error:
        return DraftResult(draft=None, error=f"invalid output: {error}", **common)


async def draft_all(
    entries: list[littre.Entry], models: tuple[str, ...] = MODELS, concurrency: int = 6
) -> list[DraftResult]:
    client = anthropic.AsyncAnthropic(max_retries=4)
    semaphore = asyncio.Semaphore(concurrency)

    async def guarded(model: str, entry: littre.Entry) -> DraftResult:
        async with semaphore:
            try:
                return await draft_card(client, model, entry)
            except anthropic.APIError as error:
                return DraftResult(
                    word=entry.headword.lower(),
                    model=model,
                    draft=None,
                    error=repr(error),
                    stop_reason=None,
                    usage={},
                    cost_usd=0.0,
                    latency_s=0.0,
                )

    return await asyncio.gather(*(guarded(m, e) for e in entries for m in models))
