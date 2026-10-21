"""Throwaway: local listening page out/ecoute.html for the 20 hard words and the 39 random
ones: human recording (Commons), Piper raw, Piper guided, with the phonemes of each.

Run after human_sample.py and piper_trial.py: python3 rnd/prononciation/ecoute.py
then open rnd/prononciation/out/ecoute.html in a browser.
"""

import html
import json
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"


# What to listen for on each hard word (the trap a reader falls into).
HINTS = {
    "ambesas": "le s final se prononce", "comput": "le t final se prononce", "orémus": "le s final se prononce",
    "tacet": "le t final se prononce", "palus": "le s final se prononce", "introït": "in-tro-ite, le t se prononce",
    "chorographe": "ch se dit k", "épichérème": "ch se dit k", "nychthémère": "ch se dit k (nik-té)",
    "picrochole": "ch se dit k", "didrachme": "ch se dit k (drakm)", "casoar": "ka-zo-ar, à la française",
    "lycanthrope": "à la française, th = t", "léthifère": "à la française, th = t", "apathiste": "th = t",
    "pensum": "pin-som (en = in)", "canzone": "z se dit ts", "quinquatries": "kuin-koua",
    "magnaud": "gn mouillé", "faraud": "d final muet",
}


GOOGLE = ["chirp3-hd-charon", "chirp3-hd-kore", "neural2-g"]


def cell(path: str, label: str) -> str:
    if not (OUT / path).exists():
        return "<td>—</td>"
    return f'<td><audio controls preload="none" src="{html.escape(path)}"></audio><br><small>{html.escape(label)}</small></td>'


def main() -> None:
    piper = json.loads((OUT / "piper.json").read_text())
    kokoro = json.loads((OUT / "kokoro.json").read_text()) if (OUT / "kokoro.json").exists() else {}
    human = json.loads((OUT / "human.json").read_text())
    heard = json.loads((OUT / "recognised.json").read_text())
    littre = json.loads((OUT / "sources.json").read_text())["littre"]
    groups = [("20 mots difficiles", json.loads((HERE / "words20.json").read_text())), ("39 mots au hasard", json.loads((HERE / "words40.json").read_text()))]
    rows = []
    for title, words in groups:
        rows.append(f'<tr><th colspan="12">{title}</th></tr>')
        for item in words:
            w = item["word"]
            p = piper[w]
            h = human.get(w)
            credit = f"{h['artist'].splitlines()[0].replace('Speaker: ', '')}, {h['licence']}" if h else ""
            said = (littre.get(w) or [""])[0].split(";")[0].split(",")[0]
            hint = HINTS.get(w, "")
            rows.append(
                "<tr>"
                f"<td><b>{html.escape(w)}</b><br>se dit <b>« {html.escape(said)} »</b>"
                f"<br><small>{html.escape(hint)}</small><br><small>{html.escape(p['ipa'])}</small></td>"
                + cell(f"human/{w}.opus", f"{credit} · entendu {heard.get(w + '.opus', '')}")
                + cell(f"audio/{w}.piper-raw.opus", f"{p['raw_phonemes']} · entendu {heard.get(w + '.piper-raw.opus', '')}")
                + cell(f"audio/{w}.piper-guided.opus", f"{p['guided_phonemes']} · entendu {heard.get(w + '.piper-guided.opus', '')}")
                + cell(f"audio/{w}.kokoro-raw.opus", f"{kokoro.get(w, {}).get('raw_phonemes', '')} · entendu {heard.get(w + '.kokoro-raw.opus', '')}")
                + cell(f"audio/{w}.kokoro-guided.opus", f"{kokoro.get(w, {}).get('guided_phonemes', '')} · entendu {heard.get(w + '.kokoro-guided.opus', '')}")
                + "".join(
                    cell(f"audio/{w}.google-{v}-{k}.opus", f"entendu {heard.get(f'{w}.google-{v}-{k}.opus', '')}")
                    for v in GOOGLE
                    for k in ("raw", "guided")
                )
                + "</tr>"
            )
    GOOGLE_HEADERS = "".join(f"<th>Google {v} {k}</th>" for v in GOOGLE for k in ("brut", "guidé"))
    page = f"""<!doctype html><meta charset="utf-8"><title>Écoute prononciation</title>
<style>body{{font-family:system-ui;margin:16px}}td,th{{border-bottom:1px solid #ccc;padding:6px;vertical-align:top}}audio{{width:180px}}</style>
<h1>Prononciation : écoute comparée</h1>
<p>Colonne Mot : la prononciation attendue en clair (graphie du Littré : l\'apostrophe veut dire que la consonne finale se prononce), le piège à écouter, puis la notation du Wiktionnaire. Ensuite : enregistrement humain (Commons), Piper, Kokoro et Google, sans guide puis guidés par la notation phonétique.
« entendu » : ce qu'a reconnu wav2vec2 (bruité).</p>
<table><tr><th>Mot</th><th>Humain</th><th>Piper brut</th><th>Piper guidé</th><th>Kokoro brut</th><th>Kokoro guidé</th>{GOOGLE_HEADERS}</tr>
{''.join(rows)}</table>"""
    (OUT / "ecoute.html").write_text(page)


if __name__ == "__main__":
    main()
