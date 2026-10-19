"""Words never made into cards, whatever the model or the dictionary says (D-019).

The trial showed that no model catches every slur, and that some modern slur senses are absent
from the Littré. This list is the deterministic floor under the model's judgement and the human
review, not a replacement for them. It holds words whose main use today targets a group; old
insults aimed at a person (faquin, maroufle) stay editorial decisions.
"""

SLURS = frozenset(
    {
        # Racist or xenophobic.
        "bamboula",
        "bicot",
        "bougnoul",
        "bougnoule",
        "boucaque",
        "chinetoque",
        "crouille",
        "macaroni",
        "métèque",
        "moricaud",
        "nègre",
        "négresse",
        "négrillon",
        "négro",
        "niakoué",
        "raton",
        "rastaquouère",
        "rital",
        # Antisemitic.
        "youpin",
        "youpine",
        "youtre",
        # Homophobic.
        "enculé",
        "fiotte",
        "gouine",
        "inverti",
        "pédale",
        "pédé",
        "sodomite",
        "tantouze",
        "tapette",
        "tarlouze",
        # Sexist.
        "pétasse",
        "pouffiasse",
        "salope",
        # Ableist.
        "gogol",
        "mongol",
    }
)


def is_excluded(word: str) -> bool:
    return word.lower() in SLURS
