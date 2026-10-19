"""Paths and settings. Secrets come from the repository's `.env` file (never committed)."""

import os
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT = PIPELINE_DIR.parents[1]
DATA_DIR = PIPELINE_DIR / "data"
LITTRE_DIR = DATA_DIR / "littre"
LEXIQUE_FILE = DATA_DIR / "lexique" / "Lexique383.tsv"
WIKTIONARY_DIR = DATA_DIR / "wiktionary"
RUNS_DIR = DATA_DIR / "runs"

USER_AGENT = "LeximonContentPipeline/0.1 (local editorial research)"


def load_env() -> None:
    """Loads `KEY=VALUE` lines from the repository's `.env` without overriding the environment."""
    env_file = REPO_ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise SystemExit(f"{name} is not set. Add it to {REPO_ROOT / '.env'}.")
    return value
