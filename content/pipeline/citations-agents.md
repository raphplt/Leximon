# Consigne des agents qui choisissent les citations (D-058)

Donnée telle quelle à chaque agent Claude Code, avec ses lignes et son fichier de sortie, après `citations-search`. Elle est en anglais, comme les consignes de la chaîne. `citations-apply` contrôle ensuite chaque choix.

---

You choose quotes for Leximon, a French card game about rare and old words. Each card shows the word, a short definition and, when one exists, a short quote that shows the word in use. These cards have no quote in the Littré, so we look for one in public-domain texts on fr.wikisource. Write in French where text is asked for. Do not edit any file other than your output, and do not run git.

Input: `content/pipeline/data/citations/candidates.jsonl`, one card per line: `{id, word, definition, collection, candidates}`. Each candidate is a Wikisource page with `title`, `url`, `author`, `year` (edition), `author_death` (from Wikidata) and `sentences`, the page's sentences that hold the word.

Your cards: LINES (line numbers in that file, counting from 1). Read only those lines, a few at a time.

For each card, keep at most one quote, or none. A good quote:
- **Sense:** uses the word itself, in the card's sense, as a common noun, verb or adjective. Reject:
  - proper names (a Mr Fromental, a place);
  - cross-references ("Voyez Bernacle");
  - headwords and dictionary-style definitions ("BERNACLE, s. f. …", "On appelle X…", "On a appellé…");
  - a different sense from the card's;
  - a word that is only an OCR typo for another one.
- **Usefulness:** shows the word in use and reads on its own. Prefer a lively sentence (a description, a practice, a comparison, a line of verse) over a dry technical one. Prefer literary or classic authors over anonymous reports.
- **Length:** 200 characters or fewer if possible, never over 300.
- **Rights:** `author_death` is 1955 or earlier, or `year` is 1870 or earlier. Otherwise reject the quote. Also reject a translation (a foreign author such as Tolstoy, Darwin or Dickens): its French translator holds rights we cannot check.
- **Exactness:** copy the sentence word for word, with its old spelling ("&", "étoit", "pieces") and its punctuation. You may only:
  - drop the final full stop (the cards show quotes without one);
  - cut off the start or the end at a clause boundary;
  - remove a middle part, replacing it with "....".

  You may not change, add or modernise a single word.

Output: write OUTFILE, a JSON object keyed by card id, with one entry for each of your cards:

```json
{"<id>": {"quote_text": "<quote or null>", "quote_author": "<usual short name, as cards show it: Buffon, Rozier, Voltaire, La Fontaine, Colette…; for an anonymous text, the work, such as « L'Encyclopédie »; null if no quote>", "note": "<one short French phrase: why this one, or why none>"}}
```

Then check your output: run `cd content/pipeline && uv run python -m leximon_content citations-apply`. It checks every picks file at once, so look only at the lines about your cards. Fix every quote it refuses, or set that card's quote to null.

Reply with one line: how many cards got a quote, how many got none, and any doubt.
