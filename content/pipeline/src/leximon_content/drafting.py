"""Drafts card text from a Littré entry with Claude. The model only rewrites and chooses: the
quote is picked by number from the entry, and the era is computed from the entry's history."""

import asyncio
import json
import re
import time
import unicodedata
from dataclasses import dataclass
from typing import Literal

import anthropic
from pydantic import BaseModel, ValidationError

from . import littre
from .llm import USAGE_KEYS, cost

#: Chosen after the 50-word trial (D-019).
MODEL = "claude-sonnet-5-5"
#: Models compared by `draft --compare`.
COMPARED_MODELS = ("claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5")
MAX_DEFINITION_WORDS = 25

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

#: Shared with the pre-screen (prescreen.py), which predicts the same opinion more cheaply.
SUITABILITY_GUIDE = """   - ok : mot rare ou ancien, avec du charme ou une histoire ;
   - trop_courant : mot encore d'usage courant aujourd'hui dans son sens principal ;
   - trop_technique : vocabulaire scientifique ou technique sans attrait pour le grand public ;
   - offensant_aujourdhui : injure raciste, sexiste, homophobe ou visant un groupe, à écarter ;
   - vulgaire : grossier au point de ne pas convenir à un public adolescent ;
   - sens_incertain : l'entrée ne permet pas de rédiger une carte fiable.
"""

SYSTEM_PROMPT = (
    """Tu rédiges le texte des cartes de Leximon, un jeu de cartes à collectionner sur les mots rares et anciens du français. On te donne l'entrée du dictionnaire de Littré (1863) pour un mot.

Règles :
1. Appuie-toi uniquement sur l'entrée fournie. N'invente ni sens, ni date, ni étymologie.
2. definition : en français moderne et clair, 25 mots au maximum, une phrase si possible. Reformule avec tes mots, ne recopie pas le Littré. Si le mot a plusieurs sens, garde celui qui fait la meilleure carte (souvent le plus ancien ou le plus pittoresque) ; mentionne au plus un second sens.
3. etymology : 30 mots au maximum, d'après la rubrique ÉTYMOLOGIE. Si elle manque ou si le Littré la dit incertaine, écris « Origine incertaine. »
4. quote_index : le numéro de la citation la plus parlante, de préférence courte (moins de 200 caractères), qui montre le mot en usage. null si aucune ne convient.
5. quote_author : le nom complet de l'auteur de cette citation, à partir de l'abréviation du Littré (par exemple MOL. donne Molière). Si tu n'es pas certain, recopie l'abréviation telle quelle. null si quote_index est null.
6. part_of_speech : la nature abrégée (n. m., n. f., adj., v. tr., v. intr., adv., loc., interj.).
7. themes : un à trois thèmes parmi la liste autorisée.
8. suitability : ton avis sur l'intérêt du mot pour une carte de collection.
"""
    + SUITABILITY_GUIDE
    + """   suitability_reason : une phrase qui justifie ton avis.
9. pepite : true si le mot est une pépite, une carte qu'on serait fier de tirer : une sonorité, une image ou une histoire qui frappent. Sois exigeant, un mot sur trois au plus. Les pépites les plus rares deviennent les cartes Épiques et Légendaires.

Ton : sobre et précis. Le charme vient du mot lui-même, pas d'un commentaire ajouté."""
)

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
        "pepite": {"type": "boolean"},
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
        "pepite",
    ],
    "additionalProperties": False,
}


def words(text: str) -> list[str]:
    """Words without accents or case, so that counts and comparisons ignore spelling details."""
    folded = unicodedata.normalize("NFKD", text.lower())
    return re.findall(r"[a-z0-9]+", folded.encode("ascii", "ignore").decode())


class CardDraft(BaseModel):
    definition: str
    etymology: str
    quote_index: int | None
    quote_author: str | None
    part_of_speech: str
    themes: list[Literal[THEMES]]  # type: ignore[valid-type]
    suitability: Literal[SUITABILITY]  # type: ignore[valid-type]
    suitability_reason: str
    #: Absent from the drafts made before D-020.
    pepite: bool = False


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
    #: True when the definition was too long and the model was asked for a shorter one.
    shortened: bool = False

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
            "shortened": self.shortened,
        }


def correction_request(problems: list[str]) -> str:
    listed = "\n".join(f"- {problem}" for problem in problems)
    return (
        "Un vérificateur a comparé ta carte à l'entrée et relevé ces problèmes :\n"
        f"{listed}\n\nCorrige la carte : retire ou corrige chaque affirmation signalée, sans rien "
        "ajouter que l'entrée ne donne pas. Garde les autres champs identiques."
    )


async def draft_card(
    client: anthropic.AsyncAnthropic,
    model: str,
    entry: littre.Entry,
    correction: tuple[CardDraft, list[str]] | None = None,
) -> DraftResult:
    """Drafts the card, or with `correction` (a previous draft and the verifier's problems)
    redrafts it in the same conversation."""
    started = time.monotonic()
    messages: list[dict[str, str]] = [
        {"role": "user", "content": littre.render(entry) + "\n\nRédige la carte."}
    ]
    if correction is not None:
        previous, problems = correction
        messages += [
            {"role": "assistant", "content": previous.model_dump_json()},
            {"role": "user", "content": correction_request(problems)},
        ]
    usage = dict.fromkeys(USAGE_KEYS, 0)
    shortened = False
    while True:
        response = await client.messages.create(
            model=model,
            max_tokens=8000,
            system=[
                {"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}
            ],
            messages=messages,
            output_config={
                "format": {"type": "json_schema", "schema": OUTPUT_SCHEMA},
                "effort": "medium",
            },
        )
        for key in USAGE_KEYS:
            usage[key] += getattr(response.usage, key) or 0
        common = {
            "word": entry.headword.lower(),
            "model": model,
            "stop_reason": response.stop_reason,
            "usage": usage,
            "cost_usd": cost(model, usage),
            "latency_s": time.monotonic() - started,
            "shortened": shortened,
        }
        if response.stop_reason != "end_turn":
            return DraftResult(draft=None, error=f"stop_reason={response.stop_reason}", **common)
        text = next((block.text for block in response.content if block.type == "text"), "")
        try:
            draft = CardDraft.model_validate(json.loads(text))
        except (json.JSONDecodeError, ValidationError) as error:
            return DraftResult(draft=None, error=f"invalid output: {error}", **common)

        length = len(words(draft.definition))
        if length <= MAX_DEFINITION_WORDS or shortened:
            # A second overlong answer is kept as is: the automatic checks flag it for review.
            return DraftResult(draft=draft, error=None, **common)
        shortened = True
        messages += [
            {"role": "assistant", "content": text},
            {
                "role": "user",
                "content": f"La définition fait {length} mots, le maximum est "
                f"{MAX_DEFINITION_WORDS}. Raccourcis-la sans changer de sens ; garde les autres "
                "champs identiques.",
            },
        ]


async def draft_all(
    entries: list[littre.Entry], models: tuple[str, ...] = (MODEL,), concurrency: int = 6
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
