import json
from pathlib import Path

import pytest

from leximon_content import pronunciation as p


@pytest.mark.parametrize(
    ("respelling", "ipa"),
    [
        ("ko-ro-gra-f'", "kɔʁɔɡʁaf"),  # ch grec written k, sounded final consonant
        ("an-be-zas'", "ɑ̃bəzas"),  # sounded final s
        ("kon-put'", "kɔ̃pyt"),
        ("fa-rô", "faʁo"),  # silent final d, not written
        ("ma-gnô", "maɲo"),
        ("kuin-koua-trie", "kɥɛ̃kwatʁi"),
        ("kan-tso-n'", "kɑ̃tsɔn"),
        ("pa-llo, ll mouillées", "pajɔ"),
        ("pin-som' ; quelques-uns disent pin-son", "pɛ̃sɔm"),  # first reading only
        ("dé-zan-nor-gheu-llir, ll mouillées", "dezɑ̃nɔʁɡøjiʁ"),
    ],
)
def test_littre_respelling_becomes_ipa(respelling: str, ipa: str) -> None:
    assert p.littre_to_ipa(respelling) == ipa


def test_same_ignores_what_speakers_vary_on() -> None:
    assert p.same("kɔʁɔɡʁaf", "koʁɔɡʁaf")  # o or ɔ
    assert p.same("ʁapətase", "ʁaptase")  # optional schwa
    assert p.same("kʁɔkiɲɔl", "kʁokinjɔl")  # gn read [ɲ] or [nj]
    assert p.same("kapʁijɛʁ", "kapʁiɛʁ")  # glide or hiatus
    assert not p.same("ʃɔʁɔɡʁaf", "kɔʁɔɡʁaf")
    assert not p.same("ɑ̃bza", "ɑ̃bzas")
    assert not p.same("", "")


def test_espeak_switching_language_is_ignored() -> None:
    assert p.clean_espeak("(en)lˈeɪθɪfə(fr)") == ""
    assert p.clean_espeak("kɔ̃pˈyt") == "kɔ̃pyt"


def test_littre_and_espeak_agreeing_settle_the_notation() -> None:
    n = p.decide("comput", "comput", "kon-put'", "kɔ̃pˈyt", [])
    assert (n.status, n.ipa) == ("accord", "kɔ̃pyt")


def test_wiktionary_decides_without_being_copied() -> None:
    # eSpeak drops the final s; the Wiktionnaire sides with the Littré, whose notation is kept.
    n = p.decide("ambesas", "ambesas", "an-be-zas'", "ɑ̃bzˈa", ["ɑ̃.bzas"])
    assert (n.status, n.ipa) == ("littre", "ɑ̃bəzas")
    # The Littré's 19th-century hiatus loses; eSpeak's reading is kept.
    n = p.decide("diaprer", "diaprer", "di-a-pré", "djapʁˈe", ["dja.pʁe"])
    assert (n.status, n.ipa) == ("espeak", "djapʁe")


def test_unsettled_words_wait_for_the_owner_then_take_the_correction() -> None:
    n = p.decide("pensum", "pensum", "pin-som'", "pɑ̃sˈɔm", ["pɛ̃.sɔn"])
    assert (n.status, n.ipa) == ("a-relire", "")
    n = p.decide("pensum", "pensum", "pin-som'", "pɑ̃sˈɔm", ["pɛ̃.sɔn"], "pɛ̃sɔm")
    assert (n.status, n.ipa) == ("relu", "pɛ̃sɔm")


def test_ssml_escapes_the_word_and_the_notation() -> None:
    assert (
        p.ssml("a<b", 'lœj"')
        == '<speak><phoneme alphabet="ipa" ph=\'lœj"\'>a&lt;b</phoneme></speak>'
    )


def test_files_are_named_after_their_content() -> None:
    path = p.published_path("comput", b"mp3")
    assert path.startswith("prononciation/comput.") and path.endswith(".mp3")
    assert path == p.published_path("comput", b"mp3")
    assert path != p.published_path("comput", b"other")


def test_a_card_is_read_again_when_its_notation_or_the_voice_changes() -> None:
    n = p.decide("comput", "comput", "kon-put'", "kɔ̃pˈyt", [])
    assert p.stale(n, {})
    assert not p.stale(n, {"comput": {"ipa": "kɔ̃pyt", "voice": p.VOICE}})
    assert p.stale(n, {"comput": {"ipa": "kɔ̃py", "voice": p.VOICE}})
    assert p.stale(n, {"comput": {"ipa": "kɔ̃pyt", "voice": "another"}})


def test_wiktionary_notations_come_from_the_french_section_only() -> None:
    text = (
        "== {{langue|fr}} ==\n'''casoar''' {{pron|ka.zɔ.aʁ|fr}}\n== {{langue|en}} ==\n{{pron|x|fr}}"
    )
    assert p.wiktionary_notations(text) == ["ka.zɔ.aʁ"]


def test_rendered_pronunciations_keep_the_catalogue_fields(tmp_path: Path) -> None:
    path = tmp_path / "rendered.json"
    entry = {"ipa": "kɔ̃pyt", "audio": "prononciation/comput.0123456789ab.mp3", "voice": p.VOICE}
    path.write_text(json.dumps({"cards": {"comput": entry}}))
    assert p.load_pronunciations(path) == {
        "comput": {"ipa": "kɔ̃pyt", "audio": "prononciation/comput.0123456789ab.mp3"}
    }
    assert p.load_pronunciations(tmp_path / "missing.json") == {}
