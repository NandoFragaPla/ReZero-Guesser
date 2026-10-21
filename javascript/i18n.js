const STORAGE_KEY = "rezero-lang";

const messages = {
  pt: {
    guessTitle: "Adivinhe o personagem de Re:Zero de hoje!",
    yesterday: "Personagem de ontem:",
    count: "Quantidade de personagens carregados: {n}",
    revealHint: "Revelar Dica",
    loading: "Carregando Wiki...",
    typeName: "Digite o nome aqui...",
    loadError: "Erro ao carregar. Tente atualizar.",
    colCharacter: "Personagem",
    colGender: "Gênero",
    colRace: "Raça",
    colHeight: "Altura",
    colStatus: "Status",
    colAge: "Idade",
    colAffiliation: "Afiliação",
    colAffinity: "Afinidade",
    colProtection: "Proteção",
    colAuthority: "Autoridade",
    youGuessed: "Você adivinhou",
    youLost: "Você perdeu!",
    tries: "Você levou {n} tentativas",
    nextCharacter: "Próximo personagem em",
    close: "Fechar",
    unknown: "Desconhecido",
    yes: "Sim",
    no: "Não",
    hintHair: "Cabelo",
    hintAffiliation: "Afiliação",
    hintJob: "Ocupação",
    hintGear: "Equipamento",
    hintExtra: "Extra",
    allMagic: "Todos os elementos (via espíritos)",
    animeMode: "Anime Only Mode",
    completeMode: "Complete Mode",
  },
  en: {
    guessTitle: "Guess today's Re:Zero character!",
    yesterday: "Yesterday's character:",
    count: "Characters loaded: {n}",
    revealHint: "Reveal Hint",
    loading: "Loading wiki...",
    typeName: "Type the name here...",
    loadError: "Failed to load. Try refreshing.",
    colCharacter: "Character",
    colGender: "Gender",
    colRace: "Race",
    colHeight: "Height",
    colStatus: "Status",
    colAge: "Age",
    colAffiliation: "Affiliation",
    colAffinity: "Affinity",
    colProtection: "Protection",
    colAuthority: "Authority",
    youGuessed: "You guessed it",
    youLost: "You lost!",
    tries: "It took you {n} tries",
    nextCharacter: "Next character in",
    close: "Close",
    unknown: "Unknown",
    yes: "Yes",
    no: "No",
    hintHair: "Hair",
    hintAffiliation: "Affiliation",
    hintJob: "Occupation",
    hintGear: "Equipment",
    hintExtra: "Extra",
    allMagic: "All elements (via spirits)",
    animeMode: "Anime Only Mode",
    completeMode: "Complete Mode",
  },
};

const MODE_KEY = "rezero-mode";
let mode = "complete";

try {
  const savedMode = localStorage.getItem(MODE_KEY);
  if (savedMode === "anime" || savedMode === "complete") mode = savedMode;
} catch {
  mode = "complete";
}

export function getMode() {
  return mode;
}

export function setMode(next) {
  mode = next === "anime" ? "anime" : "complete";
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignora navegadores sem storage */
  }
  return mode;
}

let lang = "pt";

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "pt") lang = saved;
} catch {
  lang = "pt";
}

export function getLang() {
  return lang;
}

export function setLang(next) {
  lang = next === "en" ? "en" : "pt";
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignora navegadores sem storage */
  }
  return lang;
}

export function t(key) {
  return messages[lang][key] ?? messages.pt[key] ?? key;
}

export function format(key, vars = {}) {
  return Object.entries(vars).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    t(key),
  );
}
