"""A stand-in for the Anthropic client: answers each request with the next prepared JSON."""

import json
from types import SimpleNamespace


class FakeApi:
    def __init__(self, *answers: object, stop_reason: str = "end_turn") -> None:
        self.answers = list(answers)
        self.stop_reason = stop_reason
        self.prompts: list[str] = []
        self.messages = SimpleNamespace(create=self.create)

    async def create(self, **request: object) -> SimpleNamespace:
        self.prompts.append(request["messages"][0]["content"])  # type: ignore[index]
        return SimpleNamespace(
            stop_reason=self.stop_reason,
            content=[SimpleNamespace(type="text", text=json.dumps(self.answers.pop(0)))],
            usage=SimpleNamespace(
                input_tokens=1000,
                output_tokens=100,
                cache_creation_input_tokens=0,
                cache_read_input_tokens=0,
            ),
        )
