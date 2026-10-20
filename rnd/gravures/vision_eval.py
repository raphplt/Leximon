"""Throwaway: ask vision models to pick the engraving of each card among its Commons candidates.

Same images, same instructions for every model. Reads out/vision/candidates.json (vision_fetch.py),
writes one line per word to out/vision/results-<model>.jsonl with the answer, the usage returned
by the API, its cost (prices of content/pipeline llm.py) and the latency. A word already answered
is skipped, so an interrupted run resumes without paying twice. Stops before going over --budget
(USD, all result files counted).

Run from content/pipeline, to reuse its environment and its .env:
  uv run python ../../rnd/gravures/vision_eval.py estimate
  uv run python ../../rnd/gravures/vision_eval.py run claude-haiku-5-5 [--limit N]
  uv run python ../../rnd/gravures/vision_eval.py run claude-sonnet-5-5 [--limit N]
  uv run python ../../rnd/gravures/vision_eval.py run claude-sonnet-5-5 --tag pass2   # repeat run
"""

import argparse
import asyncio
import base64
import json
import sys
import time
from pathlib import Path

import anthropic

from leximon_content.config import load_env
from leximon_content.llm import PRICES, USAGE_KEYS, cost

HERE = Path(__file__).resolve().parent
OUT = HERE / "out" / "vision"
EFFORT = "medium"
TECHNIQUES = [
    "gravure",  # burin, eau-forte, bois, taille-douce
    "lithographie",
    "dessin au trait",
    "dessin lavé ou aquarelle",
    "peinture",
    "photographie",
    "autre",
]

SYSTEM = """Tu aides à illustrer les cartes d'un jeu sur les mots rares et anciens du français.
Chaque carte porte une petite image ancienne, retraitée en encre seule (traits sombres sur fond
clair) et affichée dans un encart d'environ 270 × 120 points.

On te donne un mot, sa définition et des images candidates numérotées, trouvées sur Wikimedia
Commons. Choisis celle qui illustre le mieux le sens du mot, ou « aucun » si aucune ne convient.

Un bon candidat :
- montre le sens du mot : l'objet, l'animal, le métier, le type humain ou la scène qu'il désigne,
  pas seulement un thème voisin ;
- est une gravure (burin, eau-forte, bois), une lithographie ou un dessin au trait. Une peinture,
  une aquarelle, une photographie ou un objet photographié ne passe pas le traitement en encre ;
- reste lisible en petit : un sujet net, pas une page de texte ni une scène minuscule.

Mieux vaut « aucun » qu'une image hors sujet ou qu'une peinture.

Réponds en JSON :
- choix : le numéro du meilleur candidat, ou "aucun" ;
- pertinence : de 0 (hors sujet) à 10 (illustre exactement le mot), pour le candidat choisi ; 0 si aucun ;
- technique_choix : la technique du candidat choisi, "sans objet" si aucun ;
- techniques : la technique de chaque candidat, dans l'ordre des numéros ;
- raison : une phrase courte."""


def schema(count: int) -> dict:
    return {
        "type": "object",
        "properties": {
            "choix": {"type": "string", "enum": [str(n) for n in range(1, count + 1)] + ["aucun"]},
            "pertinence": {"type": "integer"},
            "technique_choix": {"type": "string", "enum": TECHNIQUES + ["sans objet"]},
            "techniques": {"type": "array", "items": {"type": "string", "enum": TECHNIQUES}},
            "raison": {"type": "string"},
        },
        "required": ["choix", "pertinence", "technique_choix", "techniques", "raison"],
        "additionalProperties": False,
    }


def media_type(raw: bytes) -> str:
    # Commons serves a WebP or GIF thumbnail for some sources, whatever the file suffix.
    if raw[:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    if raw[:3] == b"GIF":
        return "image/gif"
    return "image/jpeg"


def content(word: str, entry: dict) -> list[dict]:
    blocks: list[dict] = [{"type": "text", "text": f"Mot : {word}\nDéfinition : {entry['definition']}"}]
    for cand in entry["candidates"]:
        raw = (HERE / cand["thumb"]).read_bytes()
        blocks.append({"type": "text", "text": f"Candidat {cand['n']} :"})
        data = base64.standard_b64encode(raw).decode()
        media = media_type(raw)
        blocks.append({"type": "image", "source": {"type": "base64", "media_type": media, "data": data}})
    blocks.append({"type": "text", "text": f"Choisis parmi les {len(entry['candidates'])} candidats."})
    return blocks


def image_tokens(entry: dict) -> int:
    # Vision docs: about width x height / 750 tokens per image.
    return sum(w * h // 750 for w, h in (c["thumb_size"] for c in entry["candidates"]))


def spent_so_far() -> float:
    total = 0.0
    for path in OUT.glob("results-*.jsonl"):
        total += sum(json.loads(line)["cost_usd"] for line in path.read_text().splitlines())
    return total


def estimate(entries: dict) -> None:
    with_candidates = {w: e for w, e in entries.items() if e["candidates"]}
    images = sum(image_tokens(e) for e in with_candidates.values())
    # Text: system prompt (~450 tokens), word, definition, labels; output: JSON plus thinking.
    text = len(with_candidates) * 600
    print(f"{len(with_candidates)} words with candidates, "
          f"{sum(len(e['candidates']) for e in with_candidates.values())} images, ~{images} image tokens")
    for model in ("claude-haiku-5-5", "claude-sonnet-5-5"):
        for out_tokens in (300, 1500):
            usage = {"input_tokens": images + text, "output_tokens": out_tokens * len(with_candidates)}
            print(f"  {model}: input {usage['input_tokens']}, output {out_tokens}/call -> ${cost(model, usage):.3f}")


async def ask(api: anthropic.AsyncAnthropic, model: str, word: str, entry: dict) -> dict:
    t0 = time.perf_counter()
    try:
        response = await api.messages.create(
            model=model,
            max_tokens=8000,
            system=SYSTEM,
            messages=[{"role": "user", "content": content(word, entry)}],
            output_config={"format": {"type": "json_schema", "schema": schema(len(entry["candidates"]))},
                           "effort": EFFORT},
        )
    except anthropic.APIError as error:
        return {"word": word, "model": model, "answer": None, "error": repr(error), "usage": {},
                "cost_usd": 0.0, "latency_s": round(time.perf_counter() - t0, 2)}
    latency = round(time.perf_counter() - t0, 2)
    usage = {key: getattr(response.usage, key) or 0 for key in USAGE_KEYS}
    text = next((b.text for b in response.content if b.type == "text"), "")
    answer, error = None, None
    if response.stop_reason == "end_turn":
        try:
            answer = json.loads(text)
        except json.JSONDecodeError as exc:
            error = f"invalid output: {exc}"
    else:
        error = f"stop_reason={response.stop_reason}"
    return {"word": word, "model": model, "answer": answer, "error": error, "usage": usage,
            "cost_usd": round(cost(model, usage), 6), "latency_s": latency}


async def run(entries: dict, model: str, limit: int | None, budget: float, concurrency: int,
              tag: str | None) -> None:
    out_file = OUT / (f"results-{model}-{tag}.jsonl" if tag else f"results-{model}.jsonl")
    done = set()
    if out_file.exists():
        done = {json.loads(line)["word"] for line in out_file.read_text().splitlines()
                if json.loads(line)["answer"] is not None}
    todo = [(w, e) for w, e in entries.items() if e["candidates"] and w not in done]
    if limit is not None:
        todo = todo[:limit]
    spent = spent_so_far()
    print(f"{model}: {len(todo)} words to ask, ${spent:.4f} already spent (budget ${budget})")
    api = anthropic.AsyncAnthropic(max_retries=4)
    semaphore = asyncio.Semaphore(concurrency)
    lock = asyncio.Lock()

    async def one(word: str, entry: dict) -> None:
        nonlocal spent
        async with semaphore:
            if spent > budget:
                return
            row = await ask(api, model, word, entry)
        async with lock:
            spent += row["cost_usd"]
            with out_file.open("a") as fh:
                fh.write(json.dumps(row, ensure_ascii=False) + "\n")
            answer = row["answer"] or {}
            print(f"  {word}: {answer.get('choix')} ({answer.get('technique_choix')}) "
                  f"{row['usage'].get('output_tokens')} out, ${row['cost_usd']:.4f}, {row['latency_s']}s "
                  f"{row['error'] or ''}", flush=True)

    await asyncio.gather(*(one(w, e) for w, e in todo))
    print(f"total spent: ${spent_so_far():.4f}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=["estimate", "run"])
    parser.add_argument("model", nargs="?", choices=sorted(PRICES))
    parser.add_argument("--limit", type=int)
    parser.add_argument("--budget", type=float, default=1.8)
    parser.add_argument("--concurrency", type=int, default=4)
    parser.add_argument("--tag", help="second pass of the same model, to measure run-to-run agreement")
    args = parser.parse_args()
    entries = json.loads((OUT / "candidates.json").read_text())
    if args.action == "estimate":
        estimate(entries)
        return
    if not args.model:
        sys.exit("model required")
    load_env()
    asyncio.run(run(entries, args.model, args.limit, args.budget, args.concurrency, args.tag))


if __name__ == "__main__":
    main()
