import asyncio
import json
from pathlib import Path
from types import SimpleNamespace

from leximon_content import drafting, littre

ENTRY = next(littre.iter_entries(Path(__file__).parent / "fixtures"))
SHORT = "Individu sans valeur qui se donne de grands airs."
LONG = " ".join(["mot"] * 30)


class FakeClient:
    """Answers with the given definitions in turn and records the conversations it received."""

    def __init__(self, *definitions: str) -> None:
        self.definitions = list(definitions)
        self.calls: list[list[dict[str, str]]] = []
        self.messages = SimpleNamespace(create=self.create)

    async def create(self, **request: object) -> SimpleNamespace:
        self.calls.append(list(request["messages"]))  # type: ignore[arg-type]
        draft = {
            "definition": self.definitions.pop(0),
            "etymology": "De l'italien facchino, portefaix.",
            "quote_index": None,
            "quote_author": None,
            "part_of_speech": "n. m.",
            "themes": ["insultes"],
            "suitability": "ok",
            "suitability_reason": "Insulte ancienne.",
        }
        return SimpleNamespace(
            stop_reason="end_turn",
            content=[SimpleNamespace(type="text", text=json.dumps(draft))],
            usage=SimpleNamespace(
                input_tokens=100,
                output_tokens=50,
                cache_creation_input_tokens=0,
                cache_read_input_tokens=0,
            ),
        )


def draft_with(client: FakeClient) -> drafting.DraftResult:
    return asyncio.run(drafting.draft_card(client, drafting.MODEL, ENTRY))  # type: ignore[arg-type]


def test_a_short_definition_is_kept_without_a_second_call() -> None:
    client = FakeClient(SHORT)
    result = draft_with(client)
    assert result.draft is not None and result.draft.definition == SHORT
    assert not result.shortened
    assert len(client.calls) == 1


def test_an_overlong_definition_is_asked_again_once_and_both_calls_are_paid() -> None:
    client = FakeClient(LONG, SHORT)
    result = draft_with(client)
    assert result.draft is not None and result.draft.definition == SHORT
    assert result.shortened
    assert len(client.calls) == 2
    assert "30 mots" in client.calls[1][-1]["content"]
    assert result.usage["input_tokens"] == 200


def test_a_second_overlong_answer_is_kept_for_review() -> None:
    client = FakeClient(LONG, LONG)
    result = draft_with(client)
    assert result.draft is not None and result.draft.definition == LONG
    assert len(client.calls) == 2
