"""Mechanical checks on a card draft. A failed check sends the card to human review; meaning is
checked by the faithfulness verifier (verification.py)."""

from dataclasses import dataclass

from . import littre
from .drafting import MAX_DEFINITION_WORDS, CardDraft, words
from .exclusions import is_excluded

MAX_ETYMOLOGY_WORDS = 35
MAX_QUOTE_CHARS = 300
#: A run of this many identical words with the Littré's definition counts as copying.
COPY_RUN_WORDS = 6


@dataclass(frozen=True)
class Check:
    name: str
    passed: bool
    detail: str
    #: Shown to the reviewer but never a failure.
    informational: bool = False


def _shares_run(a: str, b: str, length: int) -> bool:
    words_a, words_b = words(a), words(b)
    runs_b = {tuple(words_b[i : i + length]) for i in range(len(words_b) - length + 1)}
    return any(tuple(words_a[i : i + length]) in runs_b for i in range(len(words_a) - length + 1))


def run_checks(draft: CardDraft, entry: littre.Entry) -> list[Check]:
    definition_words = len(words(draft.definition))
    etymology_words = len(words(draft.etymology))
    littre_definitions = " ".join(sense.definition for sense in entry.senses)
    citations = entry.citations[:12]  # the citations shown to the model, see littre.render

    checks = [
        Check(
            "not_excluded",
            not is_excluded(entry.headword),
            "absent de la liste d'exclusion des injures",
        ),
        Check(
            "definition_length",
            0 < definition_words <= MAX_DEFINITION_WORDS,
            f"{definition_words} mots (maximum {MAX_DEFINITION_WORDS})",
        ),
        Check(
            "etymology_length",
            0 < etymology_words <= MAX_ETYMOLOGY_WORDS,
            f"{etymology_words} mots (maximum {MAX_ETYMOLOGY_WORDS})",
        ),
        Check(
            "not_copied",
            not _shares_run(draft.definition, littre_definitions, COPY_RUN_WORDS),
            f"aucune suite de {COPY_RUN_WORDS} mots reprise telle quelle du Littré",
            # The Littré's text is public domain: a borrowed phrase is a matter of style, not of
            # rights, and the verifier judges meaning.
            informational=True,
        ),
    ]

    if draft.quote_index is None:
        checks.append(Check("quote", True, "aucune citation retenue"))
    elif not 1 <= draft.quote_index <= len(citations):
        checks.append(Check("quote", False, f"numéro {draft.quote_index} hors de la liste"))
    else:
        quote = citations[draft.quote_index - 1].text
        checks.append(
            Check(
                "quote",
                len(quote) <= MAX_QUOTE_CHARS,
                f"{len(quote)} caractères (maximum {MAX_QUOTE_CHARS})",
            )
        )

    checks.append(
        Check(
            "suitability",
            draft.suitability == "ok",
            f"{draft.suitability} : {draft.suitability_reason}",
        )
    )
    return checks


def failed(checks: list[Check]) -> list[str]:
    return [check.name for check in checks if not check.passed and not check.informational]


def symbol(check: Check) -> str:
    if check.passed:
        return "✓"
    return "○" if check.informational else "✗"
