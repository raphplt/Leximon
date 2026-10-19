/**
 * Demo catalogue: 23 cards drafted by the content pipeline (run lot-1, D-019 and D-021).
 * Provisional: replaced by the published catalogue once its format is decided.
 * Kept in sync by hand with packages/db/seeds/dev-cards.sql.
 */
import type { CatalogCard } from "./catalog";

export const DEMO_CARDS: readonly CatalogCard[] = [
  {
    id: "sauvagesse",
    word: "sauvagesse",
    partOfSpeech: "n. f.",
    era: null,
    definition:
      "Femme sauvage, au sens plaisant ; par extension, femme sans culture ni usages du monde, peu policée.",
    quote: {
      text: "J'ai des bijoux, j'apprends je ne sais combien de belles choses, je ne suis plus du tout une sauvagesse",
      author: "Prosper Mérimée",
    },
    rarity: "common",
    collectionId: "fondateurs",
    perBillion: 62.0,
  },
  {
    id: "sapiniere",
    word: "sapinière",
    partOfSpeech: "n. f.",
    era: null,
    definition:
      "Lieu planté de sapins ; sur la Loire, nom d'un bateau en bois de sapin, plus large que le chaland.",
    quote: {
      text: "Le myrtil, le buis et le sureau sont le fléau des sapinières",
      author: "Dralet",
    },
    rarity: "common",
    collectionId: "fondateurs",
    perBillion: 275.0,
  },
  {
    id: "tripaille",
    word: "tripaille",
    partOfSpeech: "n. f.",
    era: "XVIe s.",
    definition:
      "Amas d'entrailles d'animaux, abats et boyaux entassés, que l'on jette ou que l'on apprête.",
    quote: {
      text: "Où la tripaille est frite en cent sortes de mets",
      author: "Mathurin Régnier",
    },
    rarity: "common",
    collectionId: "fondateurs",
    perBillion: 49.0,
  },
  {
    id: "raclure",
    word: "raclure",
    partOfSpeech: "n. f.",
    era: "XVe s.",
    definition:
      "Petits fragments détachés de la surface d'un corps en le raclant ; par extension, l'action même de racler.",
    quote: {
      text: "Il convient d'examiner si l'inscription a souffert quelque altération, si l'on y trouve quelque raclure de lettre",
      author: "Bouchaud",
    },
    rarity: "common",
    collectionId: "fondateurs",
    perBillion: 138.0,
  },
  {
    id: "marniere",
    word: "marnière",
    partOfSpeech: "n. f.",
    era: "XIIIe s.",
    definition:
      "Carrière d'où l'on extrait la marne, cette roche argileuse et calcaire employée pour amender les terres.",
    quote: null,
    rarity: "common",
    collectionId: "fondateurs",
    perBillion: 32.0,
  },
  {
    id: "septenaire",
    word: "septénaire",
    partOfSpeech: "adj.",
    era: null,
    definition:
      "Qui contient ou vaut sept ; par extension, qui dure sept ans, comme un parlement, ou sept jours, ou sept années de vie.",
    quote: {
      text: "Le bill qui rendait le parlement [anglais] septénaire avait enfin passé",
      author: "Saint-Simon",
    },
    rarity: "common",
    collectionId: "fondateurs",
    perBillion: 172.0,
  },
  {
    id: "glanure",
    word: "glanure",
    partOfSpeech: "n. f.",
    era: null,
    definition:
      "Ce qu'on ramasse dans les champs après la moisson : épis ou grains oubliés par les moissonneurs.",
    quote: null,
    rarity: "uncommon",
    collectionId: "fondateurs",
    perBillion: 16.0,
  },
  {
    id: "defourner",
    word: "défourner",
    partOfSpeech: "v. tr.",
    era: "XIIIe s.",
    definition: "Retirer du four ce qui vient d'y cuire, notamment le pain.",
    quote: {
      text: "Des gens enfournent ; D'autres défournent ; Aux broches tournent Veau, bœuf et mouton",
      author: "Béranger",
    },
    rarity: "uncommon",
    collectionId: "fondateurs",
    perBillion: 14.0,
  },
  {
    id: "poue",
    word: "poue",
    partOfSpeech: "interj.",
    era: null,
    definition:
      "Onomatopée qui imite le bruit sec d'une arme à feu que l'on décharge, employée surtout pour mimer un coup de pistolet.",
    quote: {
      text: "Polichinelle, faisant semblant de tirer un coup de pistolet : Poue",
      author: "Molière",
    },
    rarity: "uncommon",
    collectionId: "fondateurs",
    perBillion: 13.0,
  },
  {
    id: "odorer",
    word: "odorer",
    partOfSpeech: "v. tr.",
    era: "XIIe s.",
    definition:
      "Percevoir une odeur par l'odorat, flairer ; au sens intransitif, posséder le sens de l'odorat.",
    quote: {
      text: "Et Dieu a odoré et reçu l'odeur du sacrifice",
      author: "Pascal",
    },
    rarity: "uncommon",
    collectionId: "fondateurs",
    perBillion: 8.1,
  },
  {
    id: "ensafraner",
    word: "ensafraner",
    partOfSpeech: "v. tr.",
    era: "XIIIe s.",
    definition:
      "Teindre ou colorer en jaune orangé avec du safran, et par image, parer d'une teinte dorée, comme le fait l'aurore.",
    quote: {
      text: "Lorsque la rive basanée Fut d'elle [l'aurore] toute ensafranée",
      author: "Scarron",
    },
    rarity: "rare",
    collectionId: "fondateurs",
    perBillion: 0.91,
  },
  {
    id: "coquefredouille",
    word: "coquefredouille",
    partOfSpeech: "n. m.",
    era: null,
    definition: "Homme de peu, niais et sans esprit, qu'on regarde avec mépris ; un pauvre hère.",
    quote: {
      text: "L'espagnol, ce coquefredouille, Va toujours à l'école et perd toujours bredouille",
      author: "Antoinette Deshoulières",
    },
    rarity: "rare",
    collectionId: "fondateurs",
    perBillion: 1.8,
  },
  {
    id: "pyromancien",
    word: "pyromancien",
    partOfSpeech: "n. m.",
    era: "XVIe s.",
    definition:
      "Devin qui prétend lire l'avenir dans la forme, la couleur et les mouvements des flammes ou du feu.",
    quote: null,
    rarity: "rare",
    collectionId: "fondateurs",
    perBillion: 3.1,
  },
  {
    id: "vacillatoire",
    word: "vacillatoire",
    partOfSpeech: "adj.",
    era: null,
    definition:
      "Qui tient de la vacillation, d'un mouvement oscillant et instable, comme celui de l'anthère d'une fleur.",
    quote: {
      text: "Le mouvement vacillatoire qui se manifeste quelquefois dans l'anthère attachée par son milieu sur le filet",
      author: "Mirbel",
    },
    rarity: "precious",
    collectionId: "fondateurs",
    perBillion: 0.11,
  },
  {
    id: "poelonnee",
    word: "poêlonnée",
    partOfSpeech: "n. f.",
    era: null,
    definition:
      "Contenu d'un poêlon, soit la quantité qu'un poêlon peut contenir, par exemple une poêlonnée d'eau chaude.",
    quote: {
      text: "J'en mis une autre [rose] dans une poêlonnée d'eau chaude, elle y fut en bouillie en un moment",
      author: "Madame de Sévigné",
    },
    rarity: "precious",
    collectionId: "fondateurs",
    perBillion: 0.052,
  },
  {
    id: "ramoindrir",
    word: "ramoindrir",
    partOfSpeech: "v. tr.",
    era: null,
    definition:
      "Rendre de nouveau moindre, diminuer une seconde fois ce qui avait déjà été réduit.",
    quote: {
      text: "L'ordinaire était mesquin, on l'a encore ramoindri",
      author: "Dictionnaire de l'Académie (1696)",
    },
    rarity: "precious",
    collectionId: "fondateurs",
    perBillion: 0.13,
  },
  {
    id: "hematophobe",
    word: "hématophobe",
    partOfSpeech: "adj.",
    era: null,
    definition:
      "Se dit d'un médecin qui a horreur de la saignée et refuse d'y recourir comme remède.",
    quote: {
      text: "Le premier [Sarrazin, médecin], qui est un hémophobe recuit",
      author: "Guy Patin",
    },
    rarity: "precious",
    collectionId: "fondateurs",
    perBillion: 0.2,
  },
  {
    id: "francatu",
    word: "francatu",
    partOfSpeech: "n. m.",
    era: null,
    definition:
      "Variété de pomme rouge d'un côté et jaunâtre de l'autre, appréciée surtout parce qu'elle se garde très longtemps.",
    quote: {
      text: "Les francatu [écrit ainsi sans s] sont rouges d'un côté et jaunâtres de l'autre, se conservent longtemps, et voilà leur principal mérite",
      author: "La Quintinye",
    },
    rarity: "epic",
    collectionId: "fondateurs",
    perBillion: 0.17,
  },
  {
    id: "matrimonion",
    word: "matrimonion",
    partOfSpeech: "n. m.",
    era: null,
    definition:
      "Mot plaisant qui n'est que le latin matrimonium habillé à la française, pour dire « mariage ».",
    quote: {
      text: "Quelque autre, sous l'espoir du matrimonion, Aurait ouvert l'oreille à la tentation",
      author: "Molière",
    },
    rarity: "epic",
    collectionId: "fondateurs",
    perBillion: 0.42,
  },
  {
    id: "affolage",
    word: "affolage",
    partOfSpeech: "n. m.",
    era: null,
    definition: "Maladie des anémones qui les fait pousser en feuilles sans jamais fleurir.",
    quote: null,
    rarity: "epic",
    collectionId: "fondateurs",
    perBillion: 0.21,
  },
  {
    id: "enlarme",
    word: "enlarme",
    partOfSpeech: "n. f.",
    era: null,
    definition:
      "Terme d'oisellerie : grandes mailles que l'on ajoute à un filet de chasse aux oiseaux.",
    quote: null,
    rarity: "epic",
    collectionId: "fondateurs",
    perBillion: 0.034,
  },
  {
    id: "barbouquine",
    word: "barbouquine",
    partOfSpeech: "n. f.",
    era: null,
    definition: "Variété de salsifis, plante potagère dont on mange la racine allongée.",
    quote: null,
    rarity: "legendary",
    collectionId: "fondateurs",
    perBillion: null,
  },
  {
    id: "chagnot",
    word: "chagnot",
    partOfSpeech: "n. m.",
    era: null,
    definition:
      "Nom donné par les pêcheurs à un squale de couleur glauque, c'est-à-dire d'un bleu-vert, proche de la mer.",
    quote: null,
    rarity: "legendary",
    collectionId: "fondateurs",
    perBillion: null,
  },
];
