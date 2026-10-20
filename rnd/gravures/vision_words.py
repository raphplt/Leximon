"""The 50 words of the vision-model measurement and their Commons queries.

Queries follow method C of the first part (three short queries per word, a print-making term in
most of them, the Latin name for animals), written by hand from the definition as a model would.
The rare word itself is only searched when it is a proper name or a known subject (Lilliput,
Ganelon, charivari).
"""

# collection id -> {word: [three short queries]}
WORDS: dict[str, dict[str, list[str]]] = {
    "caracteres": {
        "coqueplumet": ["dandy caricature", "fop engraving", "petit-maître caricature"],
        "hallebreda": ["tall man caricature", "gangly caricature", "géant maigre caricature"],
        "cracoviste": ["arbre de Cracovie", "nouvellistes Palais-Royal", "newsmongers engraving"],
        "brétailler": ["duel engraving", "fencing hall engraving", "bretteur gravure"],
        "charivarieur": ["charivari", "charivari gravure", "rough music engraving"],
        "mingrelet": ["thin man caricature", "freluquet caricature", "skinny man engraving"],
        "girouetterie": ["weathercock caricature", "girouette caricature", "turncoat caricature"],
        "croûtier": ["bad painter caricature", "painter caricature", "peintre caricature"],
        "métoposcope": ["metoposcopy", "métoposcopie", "physiognomy forehead engraving"],
        "barrettade": ["doffing hat engraving", "salut chapeau gravure", "bowing courtier engraving"],
        "nyctobate": ["sleepwalker engraving", "somnambule gravure", "somnambulism"],
        "maugréeur": ["grumbler caricature", "grumpy man caricature", "grognon caricature"],
        "lucubrateur": ["scholar candlelight engraving", "scholar lamp engraving", "savant nuit gravure"],
        "picrochole": ["Picrochole", "anger allegory engraving", "colère caricature"],
        "rigri": ["miser engraving", "avare gravure", "miser counting money"],
        "papillonage": ["inconstancy allegory", "butterfly chase engraving", "papillon galant caricature"],
        "ganelonnerie": ["Ganelon", "Ganelon trahison", "treason engraving"],
    },
    "metiers": {
        "cominge": ["mortar bomb engraving", "bombe mortier gravure", "artillery mortar engraving"],
        "calebottin": ["cobbler engraving", "cordonnier gravure", "shoemaker workshop engraving"],
        "flouette": ["masthead pennant", "ship wind vane engraving", "girouette navire"],
        "grivoiser": ["tobacco rasp", "râpe à tabac", "snuff grater"],
        "trouillotte": ["lift net fishing engraving", "filet pêche gravure", "fishing net engraving"],
        "binochon": ["hoe engraving", "binette gravure", "gardener hoe engraving"],
        "dépâtisser": ["compositor type case engraving", "typesetter engraving", "imprimerie casse gravure"],
        "pétarasse": ["caulker engraving", "calfat gravure", "caulking mallet"],
        "barillard": ["galley engraving", "galère gravure", "ship barrels engraving"],
        "scramaison": ["glassmaking engraving", "verrerie gravure", "glass furnace engraving"],
        "culottin": ["breeches engraving", "culotte costume gravure", "18th century breeches"],
        "éventaillier": ["fan maker engraving", "éventailliste gravure", "fan seller engraving"],
        "antitonnerre": ["lightning rod engraving", "paratonnerre gravure", "lightning conductor"],
        "tillotter": ["hemp brake engraving", "teillage chanvre", "flax breaking engraving"],
        "tattersall": ["Tattersall's", "horse auction engraving", "vente chevaux gravure"],
        "hersillon": ["caltrop engraving", "chausse-trape", "spiked plank fortification"],
        "afflouer": ["refloating ship engraving", "stranded ship engraving", "navire échoué gravure"],
    },
    "fondateurs": {
        "aliboron": ["donkey engraving", "âne gravure", "donkey caricature"],
        "cahotage": ["stagecoach engraving", "diligence gravure", "carriage rough road"],
        "coquecigrue": ["fabulous creature engraving", "chimère gravure", "monstre fabuleux"],
        "diabloteau": ["Stercorarius pomarinus", "pomarine skua", "skua engraving"],
        "doryphore": ["Leptinotarsa decemlineata", "Colorado beetle", "Byzantine guard"],
        "éteignoir": ["candle snuffer", "éteignoir", "éteignoir caricature"],
        "gamache": ["gaiters engraving", "guêtres gravure", "spatterdashes"],
        "jaqueline": ["stoneware jug engraving", "cruche grès", "Bartmann jug"],
        "lilliput": ["Lilliput", "Gulliver Lilliput engraving", "Lilliputians"],
        "pagure": ["Pagurus", "hermit crab engraving", "bernard-l'hermite"],
        "pyromancien": ["pyromancy", "pyromancie", "divination fire engraving"],
        "schlague": ["military flogging engraving", "schlague", "running the gauntlet"],
        "redowa": ["redowa", "polka dancers engraving", "danse bal gravure"],
        "cromlek": ["cromlech engraving", "stone circle engraving", "cromlech"],
        "gastrolàtre": ["glutton caricature", "gourmand caricature", "gluttony engraving"],
        "macaribo": ["Rangifer tarandus", "reindeer engraving", "caribou engraving"],
    },
}

RUNS = {"caracteres": ["caracteres-1"], "metiers": ["metiers-1"], "fondateurs": ["fondateurs-2", "lot-1"]}
