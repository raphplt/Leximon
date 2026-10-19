"""Calls to Claude shared by every step: one structured JSON answer per request, its cost, and a
bounded number of requests in flight."""

import asyncio
import json
from collections.abc import Awaitable, Callable, Iterable
from dataclasses import dataclass
from typing import Literal

import anthropic

#: USD per million tokens: input, output, cache write, cache read (first-party API rates).
PRICES: dict[str, tuple[float, float, float, float]] = {
    "claude-opus-5-5": (4.00, 20.00, 5.00, 0.20),
    "claude-sonnet-5-5": (2.00, 10.00, 2.50, 0.20),
    "claude-haiku-5-5": (0.10, 0.50, 0.125, 0.01),
}
USAGE_KEYS = (
    "input_tokens",
    "output_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
)
Effort = Literal["low", "medium", "high"]


def cost(model: str, usage: dict[str, int]) -> float:
    price_in, price_out, price_write, price_read = PRICES[model]
    return (
        usage.get("input_tokens", 0) * price_in
        + usage.get("output_tokens", 0) * price_out
        + usage.get("cache_creation_input_tokens", 0) * price_write
        + usage.get("cache_read_input_tokens", 0) * price_read
    ) / 1_000_000


@dataclass(frozen=True)
class Answer:
    data: dict[str, object] | None
    error: str | None
    usage: dict[str, int]
    cost_usd: float


def client() -> anthropic.AsyncAnthropic:
    return anthropic.AsyncAnthropic(max_retries=4)


async def ask_json(
    api: anthropic.AsyncAnthropic,
    model: str,
    system: str,
    prompt: str,
    schema: dict[str, object],
    effort: Effort,
    max_tokens: int = 8000,
) -> Answer:
    """One request whose answer follows `schema`. API errors and unusable answers are results:
    the caller records them and a later run retries the item."""
    try:
        response = await api.messages.create(
            model=model,
            max_tokens=max_tokens,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=[{"role": "user", "content": prompt}],
            output_config={"format": {"type": "json_schema", "schema": schema}, "effort": effort},
        )
    except anthropic.APIError as error:
        return Answer(None, repr(error), {}, 0.0)
    usage = {key: getattr(response.usage, key) or 0 for key in USAGE_KEYS}
    spent = cost(model, usage)
    if response.stop_reason != "end_turn":
        return Answer(None, f"stop_reason={response.stop_reason}", usage, spent)
    text = next((block.text for block in response.content if block.type == "text"), "")
    try:
        return Answer(json.loads(text), None, usage, spent)
    except json.JSONDecodeError as error:
        return Answer(None, f"invalid output: {error}", usage, spent)


async def for_each[T, R](
    items: Iterable[T],
    work: Callable[[T], Awaitable[R]],
    on_result: Callable[[R], None],
    concurrency: int = 6,
) -> None:
    """Runs `work` on every item, `concurrency` at a time, handing each result over as soon as it
    arrives so that an interrupted run keeps what it paid for."""
    semaphore = asyncio.Semaphore(concurrency)

    async def guarded(item: T) -> R:
        async with semaphore:
            return await work(item)

    for done in asyncio.as_completed([guarded(item) for item in items]):
        on_result(await done)
