"""Pépite judge: a model independent of the drafting one (Opus) compares cards in small batches
and gives each a charm score. Every card is judged twice, among different neighbours, and keeps
the mean. The scores are recorded: the pépites, hence the rarity, are computed from them."""

import json
import random
from dataclasses import dataclass
from pathlib import Path

import anthropic
from pydantic import BaseModel, ValidationError

from . import llm

MODEL = "claude-opus-5-5"
BATCH_SIZE = 6
ROUNDS = 2
MAX_SCORE = 10

SYSTEM_PROMPT = """Tu es le jury des pépites de Leximon, un jeu de cartes à collectionner sur les mots rares et anciens du français, pour adolescents et adultes. Toutes les cartes qu'on te montre sont des mots rares ; les plus charmants deviendront les cartes Épiques et Légendaires, celles qu'on est fier de tirer et qu'on montre à ses amis.

Compare les cartes entre elles, puis donne à chacune une note de charme de 0 à 10 :
- 9-10 : un mot qu'on a envie de répéter et de placer dans une conversation, par sa sonorité, son image ou son histoire (au niveau de coquecigrue, billevesée, escogriffe) ;
- 6-8 : un mot plaisant, avec une image ou une sonorité qui frappe ;
- 3-5 : un mot correct, sans éclat ;
- 0-2 : un mot terne, technique, ou dont le sens n'évoque rien.

Juge le mot et ce que la carte en dit, pas la qualité de la rédaction. La rareté ne compte pas : toutes ces cartes sont rares. Utilise toute l'échelle : dans un lot, les notes doivent départager les cartes. Pour chaque carte, une raison de quinze mots au plus."""

OUTPUT_SCHEMA = {
    "type": "object",
    "properties": {
        "scores": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "word": {"type": "string"},
                    "score": {"type": "integer"},
                    "reason": {"type": "string"},
                },
                "required": ["word", "score", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["scores"],
    "additionalProperties": False,
}


@dataclass(frozen=True)
class Card:
    word: str
    part_of_speech: str
    definition: str
    etymology: str
    quote: str | None

    def render(self) -> str:
        lines = [f"MOT : {self.word} ({self.part_of_speech})", f"Définition : {self.definition}"]
        lines.append(f"Étymologie : {self.etymology}")
        if self.quote:
            lines.append(f"Citation : « {self.quote} »")
        return "\n".join(lines)


class Score(BaseModel):
    word: str
    score: int
    reason: str


class Scores(BaseModel):
    scores: list[Score]


def batches(words: list[str], seed: str) -> list[tuple[int, tuple[str, ...]]]:
    """(round, words) for every batch. Each round shuffles the words anew, so that a card meets
    other neighbours. A short last batch joins the previous one."""
    planned = []
    for round_number in range(1, ROUNDS + 1):
        shuffled = sorted(words)
        random.Random(f"{seed}-{round_number}").shuffle(shuffled)
        chunks = [shuffled[i : i + BATCH_SIZE] for i in range(0, len(shuffled), BATCH_SIZE)]
        if len(chunks) > 1 and len(chunks[-1]) < BATCH_SIZE // 2:
            last = chunks.pop()
            chunks[-1] += last
        planned += [(round_number, tuple(chunk)) for chunk in chunks]
    return planned


@dataclass(frozen=True)
class Judgement:
    round: int
    words: tuple[str, ...]
    scores: dict[str, int]
    reasons: dict[str, str]
    error: str | None
    cost_usd: float

    def to_json(self) -> dict[str, object]:
        return {
            "model": MODEL,
            "round": self.round,
            "words": list(self.words),
            "scores": self.scores,
            "reasons": self.reasons,
            "error": self.error,
            "cost_usd": round(self.cost_usd, 6),
        }


async def judge(api: anthropic.AsyncAnthropic, round_number: int, cards: list[Card]) -> Judgement:
    words = tuple(card.word for card in cards)
    prompt = "\n\n".join(card.render() for card in cards) + f"\n\nNote ces {len(cards)} cartes."
    answer = await llm.ask_json(api, MODEL, SYSTEM_PROMPT, prompt, OUTPUT_SCHEMA, effort="medium")

    def failed(error: str) -> Judgement:
        return Judgement(round_number, words, {}, {}, error, answer.cost_usd)

    if answer.error:
        return failed(answer.error)
    try:
        scores = Scores.model_validate(answer.data).scores
    except ValidationError as error:
        return failed(f"invalid output: {error}")
    if sorted(s.word.lower() for s in scores) != sorted(words):
        return failed(f"words judged {[s.word for s in scores]} instead of {list(words)}")
    if any(not 0 <= s.score <= MAX_SCORE for s in scores):
        return failed("score out of range")
    return Judgement(
        round_number,
        words,
        {s.word.lower(): s.score for s in scores},
        {s.word.lower(): s.reason for s in scores},
        None,
        answer.cost_usd,
    )


def load(path: Path) -> list[dict[str, object]]:
    """Successful judgements."""
    if not path.exists():
        return []
    rows = (json.loads(line) for line in path.read_text(encoding="utf-8").splitlines())
    return [row for row in rows if not row["error"]]


def mean_scores(judgements: list[dict[str, object]]) -> dict[str, float]:
    """Mean charm score of each judged word, over its rounds."""
    collected: dict[str, list[int]] = {}
    for judgement in judgements:
        for word, score in judgement["scores"].items():  # type: ignore[attr-defined]
            collected.setdefault(word, []).append(score)
    return {word: sum(scores) / len(scores) for word, scores in collected.items()}
