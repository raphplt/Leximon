"""Whole reward economy once the season ships: every source of sachets and écus a day, on the
published catalogue (four collections) and the real draw rules. Throwaway code.

Usage: python3 sim.py [scenario...]   (all scenarios by default)
"""

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
RARE, PRECIOUS, EPIC, LEGENDARY = 2, 3, 4, 5
RECYCLE = [1, 2, 5, 15, 50, 200]
PRICE = [8, 16, 40, 120, 400, 1600]
SEEDS = 8


def load_catalogue() -> dict:
    """Cards of each rarity, per collection slug, latest file of each collection."""
    latest = {}
    for path in sorted(glob.glob(str(ROOT / "apps/web/public/catalog/collections/*.json"))):
        slug = Path(path).name.split(".")[0]
        latest[slug] = path
    out = {}
    for slug, path in latest.items():
        cards = json.loads(Path(path).read_text())["cards"]
        counts = Counter(RARITIES.index(c["rarity"]) for c in cards)
        out[slug] = [counts[r] for r in range(6)]
    return out


CATALOGUE = load_catalogue()
LAUNCH = ["fondateurs", "caracteres", "metiers"]
SEASON = "betes-plantes"


def interpolate(points: list, day: float) -> float:
    for (d0, v0), (d1, v1) in zip(points, points[1:]):
        if d0 <= day <= d1:
            return v0 + (v1 - v0) * (day - d0) / (d1 - d0)
    return points[-1][1]


# What each profile does on a day it plays. Visits are the hours it opens the game, which set what
# the clock gives.
PROFILES = {
    "occasionnel": dict(
        play_every=2, visits=[20],
        challenge=0.8, missions=1.5, riddle=0.6, written=2, jousts=0, joust_win=0,
        perfect=0.3, clan_week=0, league_week=0, gilded_per_day=0.1,
        levels=[(0, 1), (1, 3), (10, 10), (43, 20), (300, 50)],
    ),
    "regulier": dict(
        play_every=1, visits=[8, 20],
        challenge=1.0, missions=2.4, riddle=0.7, written=3, jousts=1, joust_win=0.5,
        perfect=0.4, clan_week=1, league_week=15, gilded_per_day=0.5,
        levels=[(0, 1), (1, 3), (5, 10), (18, 20), (140, 50), (600, 100)],
    ),
    "applique": dict(
        play_every=1, visits=[8, 13, 20],
        challenge=1.0, missions=2.8, riddle=0.8, written=4, jousts=2, joust_win=0.6,
        perfect=0.5, clan_week=2, league_week=20, gilded_per_day=0.8,
        levels=[(0, 1), (1, 3), (4, 10), (16, 20), (121, 50), (546, 100)],
    ),
    "assidu": dict(
        play_every=1, visits=list(range(8, 24)),
        challenge=1.0, missions=3.0, riddle=1.0, written=6, jousts=5, joust_win=0.9,
        perfect=0.6, clan_week=3, league_week=30, gilded_per_day=2.0,
        levels=[(0, 1), (1, 4), (2, 10), (6, 20), (56, 50), (265, 100)],
    ),
}


def clock_per_day(visits: list, play_every: int, interval_h: float, capacity: int) -> float:
    """Sachets the clock gives a day, steady state, to a player who opens everything at each visit."""
    days = 20 * play_every
    times = [d * 24 + h for d in range(0, days, play_every) for h in visits]
    stock, last, total = capacity, times[0], 0.0
    for t in times:
        stock = min(capacity, stock + (t - last) / interval_h)
        last = t
        if t >= 24 * 10 * play_every:
            total += int(stock)
        stock -= int(stock)
    return total / (10 * play_every)


WELCOME = [("bonus", 2), ("garni", 1), ("bonus", 2), (None, 0), ("garni", 1), ("bonus", 2), ("precious", 1)]


def carnet_case(k: int) -> tuple:
    if k == 28:
        return ("precious", 1)
    if k % 7 == 0:
        return ("garni", 1)
    if k % 7 == 3:
        return ("bonus", 1)
    return ("ecus", 10)


def season_step(step: int) -> tuple:
    if step == 30:
        return ("precious", 1)
    if step % 5 == 0:
        return ("garni", 1)
    if step % 2 == 0:
        return ("bonus", 1)
    return ("ecus", 25)


# Scenario knobs: everything the economy pays, so a proposal is a dict of overrides.
BASE = dict(
    clock=(1.0, 8),  # hours between two sachets, stock
    challenge_sachet=1,
    missions_sachet=1,
    mission_ecus=10,
    joust_sachet=1,
    clan=True,
    carnet=True,
    carnet_sachets=True,
    season=True,
    season_step_fn=season_step,
    season_points_cap=200,
    level_sachets=True,
    gilded_sachet=1,
    welcome=True,
    league_garni=True,
    prices=PRICE,
    half_ecus=False,
)

SCENARIOS = {
    "A. aujourd'hui, avec la saison": {},
    "A0. aujourd'hui, sans la saison": dict(season=False),
    "B. horloge 1 h 30, 8 en stock": dict(clock=(1.5, 8)),
    "C. horloge 2 h, 6 en stock": dict(clock=(2.0, 6)),
    "C0. horloge 2 h, 6 en stock, sans la saison": dict(clock=(2.0, 6), season=False),
    "E. horloge 30 min, 6 en stock": dict(clock=(0.5, 6)),
    "D. horloge 2 h, 8 en stock": dict(clock=(2.0, 8)),
    "D2. horloge 2 h, 8 en stock, Épique 800 et Légendaire 3 200 écus": dict(
        clock=(2.0, 8), prices=[8, 16, 40, 120, 800, 3200]
    ),
    "D3. D2, missions à 5 écus, carnet et étapes de saison à moitié en écus": dict(
        clock=(2.0, 8), prices=[8, 16, 40, 120, 800, 3200], mission_ecus=5, half_ecus=True
    ),
}


class Player:
    def __init__(self, rng: random.Random, collections: list):
        self.rng = rng
        self.collections = collections
        self.copies = {}
        self.missing = {c: [set() for _ in range(6)] for c in collections}
        for c in collections:
            for r, n in enumerate(CATALOGUE[c]):
                self.missing[c][r].update(range(n))
        self.since_epic = 0
        self.since_legendary = 0
        self.ecus = 0
        self.earned = Counter()
        self.sachets = Counter()
        self.new_cards = 0
        self.cards = 0
        self.bought = 0

    def owned(self, c: str) -> int:
        return sum(CATALOGUE[c]) - sum(len(m) for m in self.missing[c])

    def share(self, c: str) -> float:
        return self.owned(c) / sum(CATALOGUE[c])

    def rarities(self, floor: int) -> list:
        rolled = self.rng.choices(range(6), WEIGHTS, k=5)
        if max(rolled) < 1:
            rolled[-1] = 1
        if max(rolled) < floor:
            rolled[-1] = self.rng.choices(range(floor, 6), WEIGHTS[floor:], k=1)[0]
        self.since_epic = 0 if max(rolled) >= EPIC else self.since_epic + 1
        self.since_legendary = 0 if max(rolled) >= LEGENDARY else self.since_legendary + 1
        if self.since_legendary >= 150:
            rolled[-1], self.since_legendary, self.since_epic = LEGENDARY, 0, 0
        elif self.since_epic >= 40:
            rolled[-1], self.since_epic = EPIC, 0
        return rolled

    def add(self, c: str, r: int, i: int, bought: bool = False) -> None:
        key = (c, r, i)
        held = self.copies.get(key, 0)
        self.cards += 1
        if held == 0:
            self.missing[c][r].discard(i)
            self.new_cards += 1
            self.bought += bought
        self.copies[key] = held + 1

    def pick(self, open_now: list) -> str:
        """The open collection where the most words are missing: the most new cards."""
        return min(open_now, key=self.share)

    def open(self, kind: str, open_now: list) -> None:
        self.sachets[kind] += 1
        c = self.pick(open_now)
        floor = {"garni": RARE, "precious": PRECIOUS}.get(kind, 0)
        counts = CATALOGUE[c]
        seen = set()
        for r in self.rarities(floor):
            i = self.rng.randrange(counts[r])
            while (r, i) in seen:
                i = self.rng.randrange(counts[r])
            seen.add((r, i))
            self.add(c, r, i)

    def recycle(self) -> None:
        """The « Garder un double » button, once a day: two copies kept, no Épique nor Légendaire."""
        for key, held in self.copies.items():
            if held > 2 and key[1] < EPIC:
                self.ecus += RECYCLE[key[1]] * (held - 2)
                self.earned["recyclage"] += RECYCLE[key[1]] * (held - 2)
                self.copies[key] = 2

    half = False

    def gain(self, source: str, amount: int) -> None:
        if self.half and source in ("carnet", "saison"):
            amount //= 2
        self.ecus += amount
        self.earned[source] += amount

    def spend(self, open_now: list, prices: list = PRICE) -> None:
        """Buys the rarest missing word it can afford, without saving up."""
        for r in range(5, -1, -1):
            while self.ecus >= prices[r]:
                pool = [c for c in open_now if self.missing[c][r]]
                if not pool:
                    break
                c = self.rng.choice(pool)
                self.ecus -= prices[r]
                self.add(c, r, self.rng.choice(sorted(self.missing[c][r])), bought=True)


def poisson_count(rng: random.Random, mean: float) -> int:
    whole = int(mean)
    return whole + (1 if rng.random() < mean - whole else 0)


def run(profile: str, scenario: dict, seed: int, veteran: bool = False, days: int = 180) -> dict:
    rules = {**BASE, **scenario}
    p = PROFILES[profile]
    rng = random.Random(seed)
    collections = LAUNCH + [SEASON]
    player = Player(rng, collections)
    player.half = rules.get("half_ecus", False)
    out = {"checkpoints": {}}
    if veteran:
        # A beta player of the same profile, 35 days on the three launch collections first.
        warm = run_days(player, p, {**rules, "season": False, "welcome": True}, rng, 35, LAUNCH, start_level_day=0)
        player.sachets.clear()
        player.earned.clear()
        player.new_cards = player.cards = player.bought = 0
        level_day0 = 35
    else:
        level_day0 = 0
    run_days(player, p, rules, rng, days, collections, start_level_day=level_day0, out=out, veteran=veteran)
    return out


def run_days(player, p, rules, rng, days, collections, start_level_day, out=None, veteran=False):
    played = 0
    season_points = 0
    season_steps = 0
    carnet_k = 0
    streak_paid = set()
    last_level = int(interpolate(p["levels"], start_level_day))
    complete_day = {}
    for day in range(1, days + 1):
        level_day = start_level_day + day
        if (day - 1) % p["play_every"]:
            record(player, out, day, collections, complete_day, season_steps)
            continue
        played += 1
        level = int(interpolate(p["levels"], level_day))
        open_now = collections if level >= 3 else ["fondateurs"]
        queue = []
        clock = clock_per_day(p["visits"], p["play_every"], *rules["clock"]) * p["play_every"]
        queue += ["clock"] * poisson_count(rng, clock)
        challenge = rng.random() < p["challenge"]
        if challenge:
            queue += ["bonus"] * rules["challenge_sachet"]
        missions = min(3, poisson_count(rng, p["missions"])) if level >= 2 else 0
        if missions == 3:
            queue += ["bonus"] * rules["missions_sachet"]
        player.gain("missions", missions * rules["mission_ecus"])
        if challenge and rng.random() < p["perfect"]:
            player.gain("sans-faute", 5)
        riddle = rng.random() < p["riddle"]
        jousts = p["jousts"] if level >= 8 else 0
        if jousts and rng.random() < p["joust_win"]:
            queue += ["bonus"] * rules["joust_sachet"]
        if rules["clan"] and level >= 5 and day % 7 == 0:
            queue += ["bonus"] * p["clan_week"]
        if level >= 8 and day % 7 == 0:
            player.gain("ligue", p["league_week"])
            if rules["league_garni"] and (level_day < 60 and day % 14 == 0 or level_day < 40 and profile_is_assidu(p)):
                queue.append("garni")
        # Level rewards: one sachet a level, a garni every 5 levels.
        if rules["level_sachets"]:
            for lv in range(last_level + 1, level + 1):
                if lv >= 2:
                    queue.append("garni" if lv % 5 == 0 and lv <= 50 else "bonus")
        last_level = level
        # Gilded words start once words have had 7 + 30 days to prove themselves.
        if level_day > 40:
            queue += ["bonus"] * (poisson_count(rng, p["gilded_per_day"]) * rules["gilded_sachet"])
        # Welcome week, then the carnet.
        if rules["welcome"] and played <= 7 and not veteran:
            kind, n = WELCOME[played - 1]
            if kind:
                queue += [kind] * n
        elif rules["carnet"]:
            carnet_k = carnet_k % 28 + 1
            kind, n = carnet_case(carnet_k)
            if kind == "ecus":
                player.gain("carnet", n)
            elif rules["carnet_sachets"]:
                queue += [kind] * n
            else:
                player.gain("carnet", 25)
        # Streak milestones.
        for threshold, ecus in ((7, 25), (30, 100), (100, 300)):
            if played >= threshold and threshold not in streak_paid and p["play_every"] == 1:
                streak_paid.add(threshold)
                player.gain("serie", ecus)
        # The season, 28 days from day 1.
        if rules["season"] and day <= 28:
            points = (
                (40 if challenge else 0)
                + 20 * missions
                + (20 if riddle else 0)
                + 5 * min(6, p["written"])
                + 10 * min(5, jousts)
            )
            season_points += min(rules["season_points_cap"], points)
            while season_steps < 30 and season_points >= 100 * (season_steps + 1):
                season_steps += 1
                kind, n = rules["season_step_fn"](season_steps)
                if kind == "ecus":
                    player.gain("saison", n)
                elif kind:
                    queue += [kind] * n
        for kind in queue:
            player.open(kind, open_now)
        player.recycle()
        player.spend(open_now, rules["prices"])
        record(player, out, day, collections, complete_day, season_steps)
    if out is not None:
        out["complete"] = complete_day
        out["played"] = played
    return out


def record(player, out, day, collections, complete_day, season_steps) -> None:
    if out is None:
        return
    for c in collections:
        if c not in complete_day and player.owned(c) == sum(CATALOGUE[c]):
            complete_day[c] = day
    if day in (7, 14, 28, 56, 90, 180):
        out["checkpoints"][day] = dict(
            owned=sum(player.owned(c) for c in collections) / sum(sum(CATALOGUE[c]) for c in collections),
            season=player.share(SEASON),
            season_wo_top=season_share_without_top(player),
            sachets=dict(player.sachets),
            earned=dict(player.earned),
            cards=player.cards,
            new=player.new_cards,
            bought=player.bought,
            steps=season_steps,
        )


def profile_is_assidu(p: dict) -> bool:
    return len(p["visits"]) > 3


def season_share_without_top(player: Player) -> float:
    counts = CATALOGUE[SEASON]
    total = sum(counts[:EPIC])
    missing = sum(len(player.missing[SEASON][r]) for r in range(EPIC))
    return 1 - missing / total


def med(values) -> float:
    return st.median(values)


def report(name: str, scenario: dict) -> None:
    global SCENARIO_PRICES
    SCENARIO_PRICES = scenario.get("prices", PRICE)
    print(f"## {name}\n")
    print("| Profil | Sachets/jour J8-28 | dont horloge | Écus/jour J8-28 | dont recyclage | Légendaire en jours d'écus | Catalogue J28 | J90 | J180 | Tout complété |")
    print("|---|---|---|---|---|---|---|---|---|---|")
    for profile in PROFILES:
        rows = [run(profile, scenario, seed) for seed in range(SEEDS)]
        line = summarise(rows, profile)
        print(line)
        sys.stdout.flush()
    print()
    print("Vétéran (35 jours sur les trois collections de lancement), la saison de Bêtes et plantes :\n")
    print("| Profil | Bêtes et plantes J7 | J14 | J28 | Sans Épiques ni Légendaires J7 | J14 | J28 | Complète (jours) | Étapes J28 |")
    print("|---|---|---|---|---|---|---|---|---|")
    for profile in PROFILES:
        rows = [run(profile, scenario, seed, veteran=True, days=90) for seed in range(SEEDS)]
        cells = []
        for field in ("season", "season_wo_top"):
            for d in (7, 14, 28):
                cells.append(f"{med(r['checkpoints'][d][field] for r in rows):.0%}")
        done = [r["complete"].get(SEASON) for r in rows]
        done_txt = f"{med(d or 999 for d in done):.0f}" if sum(d is None for d in done) <= len(done) / 2 else "> 90"
        steps = med(r["checkpoints"][28]["steps"] for r in rows)
        print(f"| {profile} | " + " | ".join(cells) + f" | {done_txt} | {steps:.0f} |")
        sys.stdout.flush()
    print()


def summarise(rows: list, profile: str) -> str:
    def per_day(r, d0, d1, what):
        a, b = r["checkpoints"][d0], r["checkpoints"][d1]
        span = d1 - d0
        if what == "sachets":
            return (sum(b["sachets"].values()) - sum(a["sachets"].values())) / span
        if what == "clock":
            return (b["sachets"].get("clock", 0) - a["sachets"].get("clock", 0)) / span
        if what == "ecus":
            return (sum(b["earned"].values()) - sum(a["earned"].values())) / span
    sachets = med(per_day(r, 7, 28, "sachets") for r in rows)
    clock = med(per_day(r, 7, 28, "clock") for r in rows)
    ecus = med(per_day(r, 7, 28, "ecus") for r in rows)
    recycled = med(
        (r["checkpoints"][28]["earned"].get("recyclage", 0) - r["checkpoints"][7]["earned"].get("recyclage", 0)) / 21
        for r in rows
    )
    legendary = SCENARIO_PRICES[-1] / ecus if ecus else float("inf")
    owned = [f"{med(r['checkpoints'][d]['owned'] for r in rows):.0%}" for d in (28, 90, 180)]
    total = [max(r["complete"].values()) if len(r["complete"]) == 4 else None for r in rows]
    done = f"{med(t for t in total if t):.0f} j" if sum(t is None for t in total) <= len(total) / 2 else "> 180 j"
    return (
        f"| {profile} | {sachets:.1f} | {clock / sachets:.0%} | {ecus:.0f} | {recycled / ecus:.0%} | {legendary:.0f} | "
        + " | ".join(owned)
        + f" | {done} |"
    )


if __name__ == "__main__":
    wanted = sys.argv[1:]
    print(f"Catalogue : {CATALOGUE}\n")
    for name, scenario in SCENARIOS.items():
        if not wanted or any(name.startswith(w) for w in wanted):
            report(name, scenario)
