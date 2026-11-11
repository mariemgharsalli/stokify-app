/**
 * Correspondance catégorie MobileNet → catalogue.
 *
 * Les familles / sous-familles / marques sont du texte libre en base :
 * les mots-clés français ci-dessous sont des choix arbitraires, pas une
 * taxonomie lue dans les données.
 *
 * Les alias sont les libellés ImageNet réellement renvoyés par MobileNet
 * (fichier imagenet_classes du paquet), pas des noms inventés.
 */

/**
 * Seuil arbitraire, non mesuré sur le catalogue.
 * MobileNet répartit la probabilité sur 1000 classes : un top-1 à 0,30
 * est déjà assez net. En dessous, on ne matche pas.
 * À baisser si trop de photos nettes sont rejetées, à monter si trop de faux positifs passent.
 */
export const MIN_VISUAL_CONFIDENCE = 0.3;

/**
 * Seuil plus bas pour une catégorie déjà connue (bouteille, chaussure, etc.).
 * Sur une vraie photo, MobileNet répartit souvent la probabilité : une bouteille
 * nette sort fréquemment entre 0,10 et 0,30, donc le seuil 0,30 la rejetait.
 */
export const MIN_MAPPED_CONFIDENCE = 0.1;

export const UNRECOGNIZED_PRODUCT_MESSAGE = "Produit non reconnu, essayez une autre photo";

/**
 * Ressemblance visuelle entre la photo et l'image d'un article.
 * Choix arbitraires, mesurés sur une photo sans produit (pièce, personne) :
 * le meilleur article sortait à 0,37 et tout le catalogue tenait entre 0,33 et 0,37.
 * En dessous de 0,50, ou si le meilleur ne dépasse pas la médiane d'au moins 0,04,
 * on ne montre rien. L'écart 0,08 limite les voisins d'un vrai rapprochement.
 */
/**
 * Plancher bas : une photo de produit réelle contre une photo catalogue
 * tombe souvent entre 0,35 et 0,55. L'ancien seuil 0,50 renvoyait une liste vide.
 * En dessous de 0,30, la photo ne se rapproche d'aucun article.
 */
export const MIN_LOOK_SIMILARITY = 0.3;
export const LOOK_SEPARATION = 0.04;
export const LOOK_SIMILARITY_GAP = 0.08;
export const MAX_LOOK_MATCHES = 6;

export function isVisualConfidenceEnough(confidence) {
  const value = Number(confidence);
  return Number.isFinite(value) && value >= MIN_VISUAL_CONFIDENCE;
}

/** Poids de score par champ. Choix arbitraire : un seul mot qui matche suffit (score > 0). */
const FIELD_WEIGHTS = {
  famille: 5,
  sousFamille: 4,
  libelle: 3,
  marque: 2,
  description: 1,
};

const FALLBACK_FIELDS = ["libelle", "description"];

/**
 * Mots refusés seuls. "solaire" matcherait à la fois "lunette solaire" et
 * "crème solaire". "lecteur" matcherait un "lecteur de code-barres".
 */
const BLOCKED_BARE_KEYWORDS = new Set(["solaire", "lecteur"]);

/**
 * Clé canonique → traduction affichée au client + mots-clés catalogue.
 * `fr` est la seule chaîne montrée au client pour ce label.
 */
export const VISUAL_CATALOG = {
  bottle: {
    fr: "bouteille",
    keywords: ["bouteille", "flacon", "gourde"],
  },
  jug: {
    fr: "bidon",
    keywords: ["bidon", "cruche", "jerrican", "bonbonne"],
  },
  cup: {
    fr: "tasse",
    keywords: ["tasse", "mug", "gobelet", "verre"],
  },
  shoe: {
    fr: "chaussure",
    keywords: ["chaussure", "basket", "sandale", "botte", "mocassin", "sabot"],
  },
  laptop: {
    fr: "ordinateur portable",
    keywords: ["ordinateur portable", "laptop", "pc portable"],
  },
  computer: {
    fr: "ordinateur",
    keywords: ["ordinateur fixe", "ordinateur de bureau", "unite centrale", "pc fixe"],
  },
  keyboard: {
    fr: "clavier",
    keywords: ["clavier"],
  },
  mouse: {
    fr: "souris",
    keywords: ["souris"],
  },
  screen: {
    fr: "écran",
    keywords: ["ecran", "moniteur"],
  },
  hardDisk: {
    fr: "disque dur",
    keywords: ["disque dur"],
  },
  modem: {
    fr: "modem",
    keywords: ["modem"],
  },
  phone: {
    fr: "téléphone",
    keywords: ["telephone", "smartphone", "mobile"],
  },
  backpack: {
    fr: "sac à dos",
    keywords: ["sac a dos", "cartable", "backpack"],
  },
  bag: {
    fr: "sac",
    keywords: ["sac", "sacoche", "cabas", "portefeuille", "panier"],
  },
  book: {
    fr: "livre",
    keywords: ["livre", "roman", "manuel", "bd", "bande dessinee", "cahier"],
  },
  chair: {
    fr: "chaise",
    keywords: ["chaise", "fauteuil", "siege"],
  },
  bench: {
    fr: "banc",
    keywords: ["banc"],
  },
  lamp: {
    fr: "lampe",
    keywords: ["lampe", "luminaire", "lampadaire", "abat jour", "bougie"],
  },
  desk: {
    fr: "bureau",
    keywords: ["bureau"],
  },
  table: {
    fr: "table",
    keywords: ["table"],
  },
  billiard: {
    fr: "billard",
    keywords: ["billard", "snooker"],
  },
  sofa: {
    fr: "canapé",
    keywords: ["canape", "sofa", "meridienne"],
  },
  bed: {
    fr: "lit",
    keywords: ["lit", "lit bebe"],
  },
  cradle: {
    fr: "berceau",
    keywords: ["berceau"],
  },
  bookcase: {
    fr: "bibliothèque",
    keywords: ["bibliotheque", "etagere"],
  },
  wardrobe: {
    fr: "armoire",
    keywords: ["armoire", "penderie"],
  },
  cabinet: {
    fr: "meuble de rangement",
    keywords: ["vaisselier", "classeur", "commode", "coffre"],
  },
  safe: {
    fr: "coffre-fort",
    keywords: ["coffre fort", "coffre-fort"],
  },
  pillow: {
    fr: "oreiller",
    keywords: ["oreiller", "coussin"],
  },
  quilt: {
    fr: "couette",
    keywords: ["couette", "couverture", "edredon"],
  },
  clock: {
    fr: "horloge",
    keywords: ["horloge", "pendule", "reveil"],
  },
  watch: {
    fr: "montre",
    keywords: ["montre", "chronometre"],
  },
  camera: {
    fr: "appareil photo",
    keywords: ["appareil photo", "camera", "reflex"],
  },
  binoculars: {
    fr: "jumelles",
    keywords: ["jumelle", "jumelles"],
  },
  television: {
    fr: "télévision",
    keywords: ["television", "televiseur", "tv"],
  },
  radio: {
    fr: "radio",
    keywords: ["radio", "poste radio"],
  },
  speaker: {
    fr: "enceinte",
    keywords: ["enceinte", "haut parleur", "baffle"],
  },
  microphone: {
    fr: "micro",
    keywords: ["micro", "microphone"],
  },
  remote: {
    fr: "télécommande",
    keywords: ["telecommande"],
  },
  audioPlayer: {
    fr: "lecteur audio",
    keywords: ["lecteur cd", "lecteur mp3", "baladeur", "ipod", "cassette"],
  },
  printer: {
    fr: "imprimante",
    keywords: ["imprimante", "photocopieur", "copieur"],
  },
  fridge: {
    fr: "réfrigérateur",
    keywords: ["refrigerateur", "frigo", "congelateur"],
  },
  microwave: {
    fr: "micro-ondes",
    keywords: ["micro ondes", "micro-onde", "micro onde"],
  },
  toaster: {
    fr: "grille-pain",
    keywords: ["grille pain", "toaster"],
  },
  iron: {
    fr: "fer à repasser",
    keywords: ["fer a repasser", "repassage"],
  },
  waffle: {
    fr: "gaufrier",
    keywords: ["gaufrier", "gaufre"],
  },
  vacuum: {
    fr: "aspirateur",
    keywords: ["aspirateur"],
  },
  washer: {
    fr: "lave-linge",
    keywords: ["lave linge", "machine a laver"],
  },
  dishwasher: {
    fr: "lave-vaisselle",
    keywords: ["lave vaisselle"],
  },
  sewingMachine: {
    fr: "machine à coudre",
    keywords: ["machine a coudre"],
  },
  fan: {
    fr: "ventilateur",
    keywords: ["ventilateur"],
  },
  hairDryer: {
    fr: "sèche-cheveux",
    keywords: ["seche cheveux"],
  },
  stove: {
    fr: "cuisinière",
    keywords: ["cuisiniere", "gaziniere", "plaque de cuisson"],
  },
  coffeeMaker: {
    fr: "cafetière",
    keywords: ["cafetiere", "expresso", "espresso"],
  },
  teapot: {
    fr: "théière",
    keywords: ["theiere"],
  },
  pan: {
    fr: "poêle",
    keywords: ["poele", "sauteuse", "wok"],
  },
  plate: {
    fr: "assiette",
    keywords: ["assiette"],
  },
  bowl: {
    fr: "bol",
    keywords: ["bol", "saladier"],
  },
  vase: {
    fr: "vase",
    keywords: ["vase"],
  },
  perfume: {
    fr: "parfum",
    keywords: ["parfum", "eau de toilette"],
  },
  lotion: {
    fr: "lotion",
    keywords: ["lotion", "creme"],
  },
  hairSpray: {
    fr: "laque",
    keywords: ["laque", "spray cheveux"],
  },
  sunscreen: {
    fr: "crème solaire",
    keywords: ["creme solaire", "ecran solaire"],
  },
  lipstick: {
    fr: "rouge à lèvres",
    keywords: ["rouge a levres", "lipstick"],
  },
  powder: {
    fr: "poudre",
    keywords: ["poudre"],
  },
  soap: {
    fr: "savon",
    keywords: ["savon"],
  },
  tshirt: {
    fr: "t-shirt",
    keywords: ["t shirt", "tee shirt", "tshirt"],
  },
  sweatshirt: {
    fr: "sweatshirt",
    keywords: ["sweat", "sweatshirt"],
  },
  cardigan: {
    fr: "gilet",
    keywords: ["gilet", "cardigan"],
  },
  suit: {
    fr: "costume",
    keywords: ["costume", "complet"],
  },
  jean: {
    fr: "jean",
    keywords: ["jean", "denim"],
  },
  skirt: {
    fr: "jupe",
    keywords: ["jupe"],
  },
  sarong: {
    fr: "paréo",
    keywords: ["pareo", "sarong"],
  },
  pajama: {
    fr: "pyjama",
    keywords: ["pyjama"],
  },
  swimsuit: {
    fr: "maillot de bain",
    keywords: ["maillot", "bikini", "short de bain"],
  },
  bra: {
    fr: "soutien-gorge",
    keywords: ["soutien gorge", "brassiere"],
  },
  diaper: {
    fr: "couche",
    keywords: ["couche"],
  },
  dress: {
    fr: "robe",
    keywords: ["robe"],
  },
  kimono: {
    fr: "kimono",
    keywords: ["kimono"],
  },
  apron: {
    fr: "tablier",
    keywords: ["tablier"],
  },
  coat: {
    fr: "manteau",
    keywords: ["manteau", "trench", "veste"],
  },
  poncho: {
    fr: "poncho",
    keywords: ["poncho"],
  },
  tie: {
    fr: "cravate",
    keywords: ["cravate", "noeud papillon"],
  },
  hat: {
    fr: "chapeau",
    keywords: ["chapeau", "casquette", "sombrero"],
  },
  bonnet: {
    fr: "bonnet",
    keywords: ["bonnet"],
  },
  helmet: {
    fr: "casque",
    keywords: ["casque"],
  },
  wig: {
    fr: "perruque",
    keywords: ["perruque"],
  },
  glasses: {
    fr: "lunettes",
    keywords: ["lunette", "lunettes", "lunette de soleil", "lunette solaire"],
  },
  sock: {
    fr: "chaussette",
    keywords: ["chaussette"],
  },
  mask: {
    fr: "masque",
    keywords: ["masque"],
  },
  umbrella: {
    fr: "parapluie",
    keywords: ["parapluie"],
  },
  necklace: {
    fr: "collier",
    keywords: ["collier"],
  },
  pen: {
    fr: "stylo",
    keywords: ["stylo", "crayon", "bic"],
  },
  ruler: {
    fr: "règle",
    keywords: ["regle"],
  },
  envelope: {
    fr: "enveloppe",
    keywords: ["enveloppe"],
  },
  towel: {
    fr: "serviette",
    keywords: ["serviette", "essuie tout", "papier toilette"],
  },
  ball: {
    fr: "ballon",
    keywords: ["ballon", "balle"],
  },
  racket: {
    fr: "raquette",
    keywords: ["raquette"],
  },
  ski: {
    fr: "ski",
    keywords: ["ski"],
  },
  bike: {
    fr: "vélo",
    keywords: ["velo", "bicyclette", "vtt"],
  },
  scooter: {
    fr: "scooter",
    keywords: ["scooter", "trottinette"],
  },
  teddy: {
    fr: "peluche",
    keywords: ["peluche", "nounours", "ourson"],
  },
  puzzle: {
    fr: "puzzle",
    keywords: ["puzzle", "casse tete"],
  },
  balloon: {
    fr: "ballon gonflable",
    keywords: ["baudruche", "ballon gonflable"],
  },
  guitar: {
    fr: "guitare",
    keywords: ["guitare"],
  },
  wine: {
    fr: "vin",
    keywords: ["vin"],
  },
  coffee: {
    fr: "café",
    keywords: ["cafe"],
  },
  bandage: {
    fr: "pansement",
    keywords: ["pansement", "sparadrap"],
  },
};

/**
 * Libellé ImageNet complet → clé canonique.
 * Une entrée = une classe du fichier imagenet_classes de MobileNet.
 */
const RAW_ALIASES = [
  ["beer bottle", "bottle"],
  ["water bottle", "bottle"],
  ["wine bottle", "bottle"],
  ["pop bottle, soda bottle", "bottle"],
  ["pill bottle", "bottle"],
  ["water jug", "jug"],
  ["whiskey jug", "jug"],
  ["coffee mug", "cup"],
  ["cup", "cup"],
  ["measuring cup", "cup"],
  ["goblet", "cup"],
  ["beer glass", "cup"],
  ["beaker", "cup"],
  ["running shoe", "shoe"],
  ["Loafer", "shoe"],
  ["clog, geta, patten, sabot", "shoe"],
  ["sandal", "shoe"],
  ["cowboy boot", "shoe"],
  ["laptop, laptop computer", "laptop"],
  ["notebook, notebook computer", "laptop"],
  ["desktop computer", "computer"],
  ["hand-held computer, hand-held microcomputer", "computer"],
  ["computer keyboard, keypad", "keyboard"],
  ["mouse, computer mouse", "mouse"],
  ["monitor", "screen"],
  ["screen, CRT screen", "screen"],
  ["hard disc, hard disk, fixed disk", "hardDisk"],
  ["modem", "modem"],
  ["printer", "printer"],
  ["photocopier", "printer"],
  ["cellular telephone, cellular phone, cellphone, cell, mobile phone", "phone"],
  ["dial telephone, dial phone", "phone"],
  ["pay-phone, pay-station", "phone"],
  ["backpack, back pack, knapsack, packsack, rucksack, haversack", "backpack"],
  ["purse", "bag"],
  ["mailbag, postbag", "bag"],
  ["plastic bag", "bag"],
  ["shopping basket", "bag"],
  ["hamper", "bag"],
  ["wallet, billfold, notecase, pocketbook", "bag"],
  ["comic book", "book"],
  ["book jacket, dust cover, dust jacket, dust wrapper", "book"],
  ["binder, ring-binder", "book"],
  ["folding chair", "chair"],
  ["rocking chair, rocker", "chair"],
  ["barber chair", "chair"],
  ["throne", "chair"],
  ["park bench", "bench"],
  ["table lamp", "lamp"],
  ["lampshade, lamp shade", "lamp"],
  ["candle, taper, wax light", "lamp"],
  ["torch", "lamp"],
  ["desk", "desk"],
  ["dining table, board", "table"],
  ["pool table, billiard table, snooker table", "billiard"],
  ["studio couch, day bed", "sofa"],
  ["four-poster", "bed"],
  ["crib, cot", "bed"],
  ["cradle", "cradle"],
  ["bookcase", "bookcase"],
  ["wardrobe, closet, press", "wardrobe"],
  ["china cabinet, china closet", "cabinet"],
  ["file, file cabinet, filing cabinet", "cabinet"],
  ["chiffonier, commode", "cabinet"],
  ["chest", "cabinet"],
  ["medicine chest, medicine cabinet", "cabinet"],
  ["safe", "safe"],
  ["pillow", "pillow"],
  ["quilt, comforter, comfort, puff", "quilt"],
  ["analog clock", "clock"],
  ["digital clock", "clock"],
  ["wall clock", "clock"],
  ["digital watch", "watch"],
  ["stopwatch, stop watch", "watch"],
  ["reflex camera", "camera"],
  ["Polaroid camera, Polaroid Land camera", "camera"],
  ["binoculars, field glasses, opera glasses", "binoculars"],
  ["television, television system", "television"],
  ["radio, wireless", "radio"],
  ["loudspeaker, speaker, speaker unit, loudspeaker system, speaker system", "speaker"],
  ["microphone, mike", "microphone"],
  ["remote control, remote", "remote"],
  ["CD player", "audioPlayer"],
  ["cassette player", "audioPlayer"],
  ["tape player", "audioPlayer"],
  ["cassette", "audioPlayer"],
  ["iPod", "audioPlayer"],
  ["refrigerator, icebox", "fridge"],
  ["microwave, microwave oven", "microwave"],
  ["toaster", "toaster"],
  ["iron, smoothing iron", "iron"],
  ["waffle iron", "waffle"],
  ["plate rack", "plate"],
  ["crossword puzzle, crossword", "puzzle"],
  ["vacuum, vacuum cleaner", "vacuum"],
  ["washer, automatic washer, washing machine", "washer"],
  ["dishwasher, dish washer, dishwashing machine", "dishwasher"],
  ["sewing machine", "sewingMachine"],
  ["electric fan, blower", "fan"],
  ["hand blower, blow dryer, blow drier, hair dryer, hair drier", "hairDryer"],
  ["stove", "stove"],
  ["rotisserie", "stove"],
  ["espresso maker", "coffeeMaker"],
  ["coffeepot", "coffeeMaker"],
  ["teapot", "teapot"],
  ["frying pan, frypan, skillet", "pan"],
  ["wok", "pan"],
  ["plate", "plate"],
  ["soup bowl", "bowl"],
  ["mixing bowl", "bowl"],
  ["vase", "vase"],
  ["perfume, essence", "perfume"],
  ["lotion", "lotion"],
  ["hair spray", "hairSpray"],
  ["sunscreen, sunblock, sun blocker", "sunscreen"],
  ["lipstick, lip rouge", "lipstick"],
  ["face powder", "powder"],
  ["soap dispenser", "soap"],
  ["jersey, T-shirt, tee shirt", "tshirt"],
  ["sweatshirt", "sweatshirt"],
  ["cardigan", "cardigan"],
  ["suit, suit of clothes", "suit"],
  ["jean, blue jean, denim", "jean"],
  ["miniskirt, mini", "skirt"],
  ["hoopskirt, crinoline", "skirt"],
  ["overskirt", "skirt"],
  ["sarong", "sarong"],
  ["pajama, pyjama, pj's, jammies", "pajama"],
  ["swimming trunks, bathing trunks", "swimsuit"],
  ["bikini, two-piece", "swimsuit"],
  ["maillot", "swimsuit"],
  ["maillot, tank suit", "swimsuit"],
  ["brassiere, bra, bandeau", "bra"],
  ["diaper, nappy, napkin", "diaper"],
  ["gown", "dress"],
  ["kimono", "kimono"],
  ["apron", "apron"],
  ["lab coat, laboratory coat", "coat"],
  ["trench coat", "coat"],
  ["fur coat", "coat"],
  ["cloak", "coat"],
  ["poncho", "poncho"],
  ["bow tie, bow-tie, bowtie", "tie"],
  ["Windsor tie", "tie"],
  ["bolo tie, bolo, bola tie, bola", "tie"],
  ["sombrero", "hat"],
  ["cowboy hat, ten-gallon hat", "hat"],
  ["bonnet, poke bonnet", "bonnet"],
  ["bathing cap, swimming cap", "bonnet"],
  ["football helmet", "helmet"],
  ["crash helmet", "helmet"],
  ["wig", "wig"],
  ["sunglasses, dark glasses, shades", "glasses"],
  ["sunglass", "glasses"],
  ["sock", "sock"],
  ["mask", "mask"],
  ["oxygen mask", "mask"],
  ["ski mask", "mask"],
  ["gasmask, respirator, gas helmet", "mask"],
  ["umbrella", "umbrella"],
  ["necklace", "necklace"],
  ["ballpoint, ballpoint pen, ballpen, Biro", "pen"],
  ["fountain pen", "pen"],
  ["quill, quill pen", "pen"],
  ["rule, ruler", "ruler"],
  ["envelope", "envelope"],
  ["bath towel", "towel"],
  ["paper towel", "towel"],
  ["toilet tissue, toilet paper, bathroom tissue", "towel"],
  ["soccer ball", "ball"],
  ["basketball", "ball"],
  ["volleyball", "ball"],
  ["baseball", "ball"],
  ["tennis ball", "ball"],
  ["golf ball", "ball"],
  ["ping-pong ball", "ball"],
  ["rugby ball", "ball"],
  ["croquet ball", "ball"],
  ["racket, racquet", "racket"],
  ["ski", "ski"],
  ["mountain bike, all-terrain bike, off-roader", "bike"],
  ["bicycle-built-for-two, tandem bicycle, tandem", "bike"],
  ["motor scooter, scooter", "scooter"],
  ["teddy, teddy bear", "teddy"],
  ["jigsaw puzzle", "puzzle"],
  ["balloon", "balloon"],
  ["acoustic guitar", "guitar"],
  ["electric guitar", "guitar"],
  ["red wine", "wine"],
  ["espresso", "coffee"],
  ["Band Aid", "bandage"],
];

/**
 * Classes ImageNet qui contiennent un mot produit mais ne sont pas ce produit.
 * Pas de mapping : on tombe sur la recherche texte de repli.
 */
const RAW_EXCLUDED = [
  "sleeping bag",
  "punching bag, punch bag, punching ball, punchball",
  "Cardigan, Cardigan Welsh corgi",
  "chiton, coat-of-mail shell, sea cradle, polyplacophore",
  "bell cote, bell cot",
  "shoe shop, shoe-shop, shoe store",
  "bookshop, bookstore, bookstall",
  "mousetrap",
  "fire screen, fireguard",
  "window screen",
  "slide rule, slipstick",
  "walking stick, walkingstick, stick insect",
  "web site, website, internet site, site",
];

export function normalizeSearchText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export const IMAGENET_TO_CATALOG = Object.fromEntries(
  RAW_ALIASES.map(([className, key]) => [normalizeSearchText(className), key])
);

const EXCLUDED_LABELS = new Set(RAW_EXCLUDED.map((name) => normalizeSearchText(name)));

const ALIAS_PHRASES = Object.keys(IMAGENET_TO_CATALOG).sort((a, b) => b.length - a.length);

function asText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    return [value.nom, value.libelle, value.name].filter((part) => typeof part === "string").join(" ");
  }
  return "";
}

function fieldText(article, field) {
  if (!article || typeof article !== "object") return "";
  if (field === "famille") {
    return normalizeSearchText([article.familleNom, article.famille].map(asText).join(" "));
  }
  if (field === "sousFamille") {
    return normalizeSearchText(
      [article.sousFamilleNom, article.sousFamille, article.sous_famille].map(asText).join(" ")
    );
  }
  if (field === "marque") {
    return normalizeSearchText([article.marqueNom, article.marque, article.brand].map(asText).join(" "));
  }
  if (field === "libelle") {
    return normalizeSearchText(asText(article.libelle || article.designation));
  }
  return normalizeSearchText(asText(article.description));
}

function wordEquals(word, keyword) {
  return word === keyword || word === `${keyword}s` || word === `${keyword}x`;
}

/** Mot entier (ou pluriel simple en s/x). Une phrase doit être une suite de mots. */
function textHitsKeyword(haystack, keyword) {
  const needle = normalizeSearchText(keyword);
  if (!needle || !haystack) return false;
  const parts = needle.split(" ");
  const words = haystack.split(" ");
  for (let i = 0; i <= words.length - parts.length; i += 1) {
    let matched = true;
    for (let j = 0; j < parts.length; j += 1) {
      if (!wordEquals(words[i + j], parts[j])) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

/**
 * Résout un libellé MobileNet (souvent "beer bottle" ou une liste de synonymes)
 * vers une clé de VISUAL_CATALOG. null = pas de mapping direct.
 */
export function resolveVisualLabel(label) {
  const full = normalizeSearchText(label);
  if (!full) return null;
  if (EXCLUDED_LABELS.has(full)) return null;
  if (IMAGENET_TO_CATALOG[full]) return IMAGENET_TO_CATALOG[full];
  if (VISUAL_CATALOG[full]) return full;

  const parts = String(label ?? "")
    .split(",")
    .map((part) => normalizeSearchText(part))
    .filter(Boolean);
  for (const part of parts) {
    if (EXCLUDED_LABELS.has(part)) return null;
    if (IMAGENET_TO_CATALOG[part]) return IMAGENET_TO_CATALOG[part];
    if (VISUAL_CATALOG[part]) return part;
  }

  // Phrases de 2 mots ou plus seulement : un mot court ("pan", "iron", "radio")
  // matcherait des classes sans rapport (chimpanzé, télescope, tire-bouchon).
  for (const phrase of ALIAS_PHRASES) {
    if (!phrase.includes(" ")) continue;
    if (textHitsKeyword(full, phrase)) return IMAGENET_TO_CATALOG[phrase];
  }
  return null;
}

/**
 * Choisit une prédiction utilisable parmi les 3 renvoyées.
 * On préfère la meilleure catégorie déjà connue du catalogue (dès 0,10),
 * sinon le premier résultat seulement s'il atteint 0,30.
 */
export function pickUsablePrediction(predictions) {
  const list = (Array.isArray(predictions) ? predictions : []).filter(
    (prediction) => Number.isFinite(Number(prediction?.score))
  );
  const mapped = list
    .filter(
      (prediction) =>
        resolveVisualLabel(prediction.label) && Number(prediction.score) >= MIN_MAPPED_CONFIDENCE
    )
    .sort((a, b) => Number(b.score) - Number(a.score));
  if (mapped.length) return mapped[0];
  const top = list[0];
  if (top && isVisualConfidenceEnough(top.score)) return top;
  return null;
}

/** Traduction française affichable. null si le label n'est pas dans la table. */
export function translateVisualLabel(label) {
  const key = resolveVisualLabel(label);
  if (!key) return null;
  return VISUAL_CATALOG[key]?.fr ?? null;
}

function isBlockedBareKeyword(keyword) {
  const needle = normalizeSearchText(keyword);
  return !needle || BLOCKED_BARE_KEYWORDS.has(needle);
}

function keywordsForLabel(label) {
  const key = resolveVisualLabel(label);
  if (!key) return [];
  return (VISUAL_CATALOG[key]?.keywords ?? []).filter((keyword) => !isBlockedBareKeyword(keyword));
}

function scoreArticle(article, keywords, fields) {
  let score = 0;
  for (const field of fields) {
    const haystack = fieldText(article, field);
    if (!haystack) continue;
    for (const keyword of keywords) {
      if (isBlockedBareKeyword(keyword)) continue;
      if (textHitsKeyword(haystack, keyword)) score += FIELD_WEIGHTS[field];
    }
  }
  return score;
}

function fallbackNeedles(label) {
  const full = normalizeSearchText(label);
  const needles = [];
  if (full.length >= 3 && !BLOCKED_BARE_KEYWORDS.has(full)) needles.push(full);
  for (const part of String(label ?? "").split(",")) {
    const normalized = normalizeSearchText(part);
    if (normalized.length >= 3 && !BLOCKED_BARE_KEYWORDS.has(normalized) && !needles.includes(normalized)) {
      needles.push(normalized);
    }
  }
  return needles;
}

/**
 * Filtre et classe les articles du catalogue pour un label MobileNet.
 * `confidence` est la probabilité MobileNet du label (0–1).
 * Catégorie connue : minimum MIN_MAPPED_CONFIDENCE. Sinon MIN_VISUAL_CONFIDENCE.
 * En dessous, ou si elle est absente, retourne [] sans chercher.
 * Retourne { article, score } du plus pertinent au moins pertinent.
 * Sans mapping direct : recherche du label anglais dans libelle / description seulement.
 */
export function matchArticlesToLabel(articles, label, confidence) {
  const value = Number(confidence);
  const minimum = resolveVisualLabel(label) ? MIN_MAPPED_CONFIDENCE : MIN_VISUAL_CONFIDENCE;
  if (!Number.isFinite(value) || value < minimum) return [];
  const list = Array.isArray(articles) ? articles : [];
  const keywords = keywordsForLabel(label);
  const fields = keywords.length ? Object.keys(FIELD_WEIGHTS) : FALLBACK_FIELDS;
  const needles = keywords.length ? keywords : fallbackNeedles(label);
  if (!needles.length) return [];

  const ranked = [];
  list.forEach((article, index) => {
    const score = scoreArticle(article, needles, fields);
    if (score > 0) ranked.push({ article, score, index });
  });

  ranked.sort((a, b) => b.score - a.score || a.index - b.index);
  return ranked.map(({ article, score }) => ({ article, score }));
}

/** Produit scalaire de deux vecteurs déjà normalisés. */
export function cosineSimilarity(left, right) {
  const length = Math.min(left?.length || 0, right?.length || 0);
  if (!length) return 0;
  let dot = 0;
  for (let i = 0; i < length; i += 1) dot += left[i] * right[i];
  return dot;
}

/** Forme du produit (MobileNet) + couleurs. Les deux vecteurs sont déjà normalisés. */
export function lookSimilarity(query, item) {
  const visual = cosineSimilarity(query?.vector, item?.vector);
  const color = cosineSimilarity(query?.color, item?.color);
  if (!query?.color || !item?.color) return visual;
  return visual * 0.62 + color * 0.38;
}

/**
 * Ne garde que les articles vraiment proches de la photo.
 * `shape` est la ressemblance de forme (0–1). `color` départage deux formes déjà proches.
 * Si rien ne se détache du catalogue, on ne propose pas de faux voisins.
 */
export function selectCloseLooks(scored) {
  const ranked = (Array.isArray(scored) ? scored : [])
    .filter((item) => item?.article && Number.isFinite(Number(item.shape)))
    .sort((a, b) => Number(b.shape) - Number(a.shape));
  if (!ranked.length) return [];
  const best = Number(ranked[0].shape);
  const backgroundIndex = Math.min(ranked.length - 1, Math.max(1, Math.floor(ranked.length * 0.5)));
  const background = Number(ranked[backgroundIndex].shape);
  const separated = ranked.length === 1 ? best >= 0.5 : best - background >= 0.04;
  const clearEnough = best >= 0.48 || (best >= 0.42 && best - background >= 0.07);
  if (!separated || !clearEnough) return [];
  const refined = ranked
    .filter((item) => best - Number(item.shape) <= 0.035)
    .map((item) => ({
      article: item.article,
      similarity: Number(item.shape),
      rank: Number(item.shape) * 0.84 + Number(item.color || 0) * 0.16,
    }))
    .sort((a, b) => b.rank - a.rank);
  return refined.slice(0, 4).map(({ article, similarity }) => ({
    article,
    similarity,
    fromLabel: false,
  }));
}

export function selectSimilarLooks(scored) {
  const ranked = (Array.isArray(scored) ? scored : [])
    .filter((item) => item?.article && Number.isFinite(Number(item.similarity)))
    .sort((a, b) => Number(b.similarity) - Number(a.similarity));
  if (!ranked.length) return [];
  const best = Number(ranked[0].similarity);
  if (best < MIN_LOOK_SIMILARITY) return [];
  return ranked
    .filter((item) => best - Number(item.similarity) <= LOOK_SIMILARITY_GAP)
    .slice(0, MAX_LOOK_MATCHES);
}

/** Les correspondances viennent de la photo, pas d'un mot-clé de catégorie. */
export function proposeSimilarLooks(visualScored) {
  return selectCloseLooks(visualScored);
}

export function frenchNameForLabel(label) {
  const key = resolveVisualLabel(label);
  if (!key || !VISUAL_CATALOG[key]) return "";
  return VISUAL_CATALOG[key].fr;
}

export function selectSimilarArticles(scored) {
  return selectSimilarLooks(scored).map((item) => item.article);
}
