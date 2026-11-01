"""Duplicate economy: compares what a duplicate can become, on the published catalogue and the real
draw rules (weights, one uncommon or better per pack, pity at 40 and 150 packs). Throwaway code."""

import glob
import json
import random
import statistics as st
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RARITIES = ["common", "uncommon", "rare", "precious", "epic", "legendary"]
WEIGHTS = [6000, 2500, 1000, 400, 90, 10]
EPIC, LEGENDARY = 4, 5
PROFILES = {"occasionnel": 3, "regulier": 8, "assidu": 20}
# Direct trades actually concluded per week: one card for one card of the same rarity.
TRADES_PER_WEEK = {"occasionnel": 0.5, "regulier": 2, "assidu": 5}
HORIZON = 540
CHECKPOINTS = [7, 30, 90, 180, 365]
SEEDS = 12

GAIN = [1, 2, 5, 15, 50, 200]
SCALES = {
    "genereux x4": [4, 8, 20, 60, 200, 800],
    "moyen x8": [8, 16, 40, 120, 400, 1600],
    "serre x16": [16, 32, 80, 240, 800, 3200],
}


def load_catalogue() -> list:
    """One list per collection: the number of cards of each rarity."""
    collections = []
    paths = glob.glob(str(ROOT / "apps/web/public/catalog/collections/*.json"))
    for path in sorted(paths):
        cards = json.loads(Path(path).read_text())["cards"]
        counts = Counter(RARITIES.index(c["rarity"]) for c in cards)
        collections.append([counts[r] for r in range(6)])
    return collections


CATALOGUE = load_catalogue()
TOTAL = sum(sum(c) for c in CATALOGUE)


class Player:
    def __init__(self, rng: random.Random):
        self.rng = rng
        self.copies = {}  # (collection, rarity, index) -> copies held
        self.obtained = Counter()  # lifetime copies, for the editions
        self.missing = [set() for _ in range(6)]
        for c, counts in enumerate(CATALOGUE):
            for r, n in enumerate(counts):
                self.missing[r].update((c, r, i) for i in range(n))
        self.since_epic = 0
        self.since_legendary = 0
        self.balance = 0
        self.earned = 0
        self.sources = Counter()

    def rarities(self) -> list:
        rolled = self.rng.choices(range(6), WEIGHTS, k=5)
        if max(rolled) < 1:
            rolled[-1] = 1
        self.since_epic = 0 if max(rolled) >= EPIC else self.since_epic + 1
        self.since_legendary = 0 if max(rolled) >= LEGENDARY else self.since_legendary + 1
        if self.since_legendary >= 150:
            rolled[-1], self.since_legendary, self.since_epic = LEGENDARY, 0, 0
        elif self.since_epic >= 40:
            rolled[-1], self.since_epic = EPIC, 0
        return rolled

    def add(self, key: tuple, source: str, keep: int) -> None:
        """Adds a copy; beyond `keep` copies it melts into currency, when `keep` is set."""
        self.obtained[key] += 1
        held = self.copies.get(key, 0)
        if held == 0:
            self.missing[key[1]].discard(key)
            self.sources[source] += 1
            self.copies[key] = 1
        elif keep and held >= keep:
            gain = GAIN[key[1]]
            self.balance += gain
            self.earned += gain
        else:
            self.copies[key] = held + 1

    def open_pack(self, collection: int, keep: int) -> None:
        counts = CATALOGUE[collection]
        seen = set()
        for r in self.rarities():
            index = self.rng.randrange(counts[r])
            while (r, index) in seen:
                index = self.rng.randrange(counts[r])
            seen.add((r, index))
            self.add((collection, r, index), "sachet", keep)

    def spend(self, prices: list) -> None:
        """Buys a random missing word, rarest affordable first, without saving up."""
        for r in range(5, -1, -1):
            while self.missing[r] and self.balance >= prices[r]:
                self.balance -= prices[r]
                key = self.rng.choice(sorted(self.missing[r]))
                self.add(key, "monnaie", 0)

    def recycle(self, keep: int, below: int = 6) -> None:
        """Manual recycling: every copy beyond `keep`, by hand, for rarities under `below`."""
        for key, held in self.copies.items():
            if held > keep and key[1] < below:
                gain = GAIN[key[1]] * (held - keep)
                self.balance += gain
                self.earned += gain
                self.copies[key] = keep

    def recipe(self) -> None:
        """Five spare copies of a rarity make one missing word of the next rarity."""
        for r in range(0, 5):
            spare = [k for k, q in self.copies.items() if k[1] == r and q > 1]
            total = sum(self.copies[k] - 1 for k in spare)
            while total >= 5 and self.missing[r + 1]:
                left = 5
                for key in spare:
                    take = min(left, self.copies[key] - 1)
                    self.copies[key] -= take
                    left -= take
                    if left == 0:
                        break
                total -= 5
                self.add(self.rng.choice(sorted(self.missing[r + 1])), "recette", 0)

    def trade(self) -> None:
        """One card for a missing card of the same rarity, if a spare and a missing one exist."""
        rarities = [
            r for r in range(5, -1, -1)
            if self.missing[r] and any(k[1] == r and q > 1 for k, q in self.copies.items())
        ]
        if rarities:
            r = rarities[0]
            key = next(k for k, q in self.copies.items() if k[1] == r and q > 1)
            self.copies[key] -= 1
            self.add(self.rng.choice(sorted(self.missing[r])), "echange", 0)

    def owned(self) -> int:
        return TOTAL - sum(len(m) for m in self.missing)

    def spares(self) -> int:
        return sum(q - 1 for q in self.copies.values())

    def spare_rare_plus(self) -> int:
        return sum(q - 1 for k, q in self.copies.items() if k[1] >= 2)


MODELS = {
    "0. statu quo, sans echange": dict(trades=False),
    "0b. statu quo + echanges": dict(trades=True),
    "1. conversion auto (garde 2)": dict(trades=True, keep=2, buy=True),
    "1b. conversion auto (garde 3)": dict(trades=True, keep=3, buy=True),
    "2. recyclage manuel (tous les 14 j)": dict(trades=True, manual=14, buy=True),
    "2b. bouton chaque jour, hors Epiques et Legendaires": dict(trades=True, manual=1, below=EPIC, buy=True),
    "3. recettes 5 -> 1": dict(trades=True, recipe=True),
}


def run(profile: str, model: dict, prices: list, seed: int) -> dict:
    rng = random.Random(seed)
    player = Player(rng)
    per_day = PROFILES[profile]
    trade_rate = TRADES_PER_WEEK[profile] / 7
    out = {}
    done_day = None
    collection = 0
    for day in range(1, HORIZON + 1):
        for _ in range(per_day):
            player.open_pack(collection, model.get("keep", 0))
            collection = (collection + 1) % 3
        if model.get("manual") and day % model["manual"] == 0:
            player.recycle(2, model.get("below", 6))
        if model.get("recipe"):
            player.recipe()
        if model.get("buy"):
            player.spend(prices)
        if model["trades"] and rng.random() < trade_rate:
            player.trade()
        if done_day is None and player.owned() == TOTAL:
            done_day = day
        if day in CHECKPOINTS:
            out[day] = dict(
                owned=player.owned() / TOTAL,
                earned=player.earned,
                balance=player.balance,
                spares=player.spares(),
                spare_rare=player.spare_rare_plus(),
                sources=dict(player.sources),
            )
    out["done"] = done_day
    out["editions"] = Counter()
    for count in player.obtained.values():
        for threshold in (2, 5, 10, 25):
            if count >= threshold:
                out["editions"][threshold] += 1
    return out


def median(rows: list, day: int, field: str) -> float:
    return st.median(r[day][field] for r in rows)


def share(rows: list, day: int, source: str) -> float:
    values = []
    for row in rows:
        sources = row[day]["sources"]
        values.append(sources.get(source, 0) / max(1, sum(sources.values())))
    return st.median(values)


def done(rows: list) -> str:
    values = [r["done"] for r in rows]
    missed = sum(v is None for v in values)
    if missed > len(values) / 2:
        return f"> {HORIZON}"
    return str(int(st.median(v if v else HORIZON for v in values)))


def main(only: str = "") -> None:
    print(f"Catalogue {TOTAL} cartes : {CATALOGUE}\n")
    for profile in PROFILES:
        print(f"## {profile} ({PROFILES[profile]} sachets par jour)\n")
        print("| Modèle | Barème | Possédé J30 | J90 | J180 | J365 | Tout complété (jours) | Part achetée J180 | Part échangée J180 | Monnaie/jour J31-90 |")
        print("|---|---|---|---|---|---|---|---|---|---|")
        for name, model in MODELS.items():
            if not name.startswith(only):
                continue
            for scale, prices in (SCALES.items() if model.get("buy") else [("-", [])]):
                rows = [run(profile, model, prices, seed) for seed in range(SEEDS)]
                income = (median(rows, 90, "earned") - median(rows, 30, "earned")) / 60
                print(
                    f"| {name} | {scale} | {median(rows, 30, 'owned'):.0%} | {median(rows, 90, 'owned'):.0%} | "
                    f"{median(rows, 180, 'owned'):.0%} | {median(rows, 365, 'owned'):.0%} | {done(rows)} | "
                    f"{share(rows, 180, 'monnaie') + share(rows, 180, 'recette'):.0%} | {share(rows, 180, 'echange'):.0%} | {income:.0f} |"
                )
            sys.stdout.flush()
        print()
    if only:
        return
    print("## Éditions : cartes ayant atteint un seuil d'exemplaires obtenus, et doubles restants\n")
    print("| Profil | Jour | 2+ | 5+ | 10+ | 25+ | Doubles sans conversion | dont Rare et mieux | Doubles, garde 2 |")
    print("|---|---|---|---|---|---|---|---|---|")
    for profile in PROFILES:
        for day in (30, 90, 180):
            horizon_rows = []
            for seed in range(SEEDS):
                rng = random.Random(seed)
                player = Player(rng)
                collection = 0
                for _ in range(day * PROFILES[profile]):
                    player.open_pack(collection, 0)
                    collection = (collection + 1) % 3
                row = {t: sum(c >= t for c in player.obtained.values()) for t in (2, 5, 10, 25)}
                row["spares"] = player.spares()
                row["rare"] = player.spare_rare_plus()
                row["kept"] = sum(1 for q in player.copies.values() if q >= 2)
                horizon_rows.append(row)
            cells = [st.median(r[k] for r in horizon_rows) for k in (2, 5, 10, 25, "spares", "rare", "kept")]
            print(f"| {profile} | J{day} | " + " | ".join(f"{c:.0f}" for c in cells) + " |")


main(sys.argv[1] if len(sys.argv) > 1 else "")
