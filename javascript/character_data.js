import { affiliationsMap } from "./character_afiliation_data.js";
import { gendersMap } from "./character_gender_data.js";
import { getLang, getMode, t } from "./i18n.js";
import { racesMap } from "./character_race_data.js";
import { statusMap } from "./character_status_data.js";

export class CharacterData {
  constructor() {
    this.wikiApi = "https://rezero.fandom.com/api.php";
    this.imageMap = {};
    this.cachedList = [];
    this.cachedShuffled = [];
    this.cachedShuffleKey = "";
    this.wikitextCache = new Map();
    this.statsCache = new Map();
    this.animeSet = null;
  }

  hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const t = y;
      y = x % y;
      x = t;
    }
    return x;
  }

  mod(n, m) {
    if (m <= 0) return 0;
    return ((n % m) + m) % m;
  }

  /** Índice do dia no calendário local, estável mesmo com horário de verão. */
  calendarDayIndex(date = new Date()) {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const start = new Date(2020, 0, 1);
    return Math.round((day.getTime() - start.getTime()) / 86400000);
  }

  /**
   * Passo coprimo com o tamanho da lista. Dias seguidos não caem em vizinhos
   * e a rotação só repete um personagem depois de percorrer a lista inteira.
   */
  dailyStep(length) {
    if (length <= 2) return 1;
    const origin = this.hashString("rezero-guesser-step-v3") % (length - 1);
    for (let k = 0; k < length - 1; k++) {
      const step = ((origin + k) % (length - 1)) + 1;
      if (step === 1 || step === length - 1) continue;
      if (this.gcd(step, length) === 1) return step;
    }
    return 1;
  }

  // Formata string para Title Case (Ex: "WITNESS" -> "Witness")
  formatTitleCase(str) {
    if (!str) return "";
    return str
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  // Busca a tradução no seu mapa. Se não existir, retorna o nome original formatado.
  translateAffiliation(name) {
    const formattedName = this.formatTitleCase(name);
    if (getLang() === "en") return formattedName;
    return affiliationsMap[formattedName] || formattedName;
  }

  translateRace(name) {
    const formattedName = this.formatTitleCase(name.trim());
    if (getLang() === "en") return formattedName;
    return racesMap[formattedName] || formattedName;
  }

  translateGender(name) {
    const formattedName = this.formatTitleCase(name.trim());
    if (getLang() === "en") return formattedName;
    return gendersMap[formattedName] || formattedName;
  }

  translateStatus(name) {
    if (!name) return t("unknown");
    const clean = name.trim().replace(/<ref.*?>.*?<\/ref>/g, "");
    if (getLang() === "en") return clean;
    // Busca exata
    if (statusMap[clean]) return statusMap[clean];
    // Busca case-insensitive e ignora espaços extras
    const normalized = clean.toLowerCase().replace(/\s+/g, " ");
    for (const key in statusMap) {
      const keyNorm = key.toLowerCase().replace(/\s+/g, " ");
      if (normalized === keyNorm) return statusMap[key];
    }
    return clean;
  }

  /** Extrai a maior idade e mantém o "+" */
  extractAge(str, charName) {
    if (charName.includes("Roswaal K.")) return t("unknown");
    if (!str || str === "N/A" || str.toLowerCase().includes("unknown"))
      return "0";

    const cleanStr = str.replace(/<ref.*?>.*?<\/ref>/g, "");
    const matches = cleanStr.match(/\d+/g);
    if (!matches) return "0";

    const ages = matches.map(Number);
    const maxAge = Math.max(...ages);

    return cleanStr.includes(`${maxAge}+`) ||
      cleanStr.includes("400+") ||
      cleanStr.includes("98+")
      ? `${maxAge}+`
      : `${maxAge}`;
  }

  /** Converte metros para centímetros */
  extractHeight(str) {
    if (!str || str === "N/A") return "0";
    const cleanStr = str.toLowerCase();
    const match = cleanStr.match(/(\d+)/);
    if (!match) return "0";

    let val = parseInt(match[1]);
    if (cleanStr.includes("m") && !cleanStr.includes("cm")) val *= 100;
    return val.toString();
  }

  translateHint(raw, kind) {
    if (!raw || raw === "N/A") return "N/A";
    const cleaned = raw.replace(/<ref[\s\S]*?<\/ref>/gi, "").replace(/[\[\]]/g, "");
    const parts = cleaned
      .split(/<br\s*\/?>/i)
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) =>
        kind === "hair" ? this.translateHairColor(part) : this.translateDebut(part),
      );
    return parts.length > 0 ? parts.join("<br>") : "N/A";
  }

  translateDebut(str) {
    const english = getLang() === "en";
    let text = str
      .replace(/Re:\s*Zero\s+Light Novel\s+Volume\s+(\d+)/gi, "Volume $1")
      .replace(/Re:\s*Zero\s+Ex\s+Light Novel\s+Volume\s+(\d+)/gi, "Ex, volume $1")
      .replace(/Re:\s*Zero\s+Tanpenshuu\s+Volume\s+(\d+)/gi, "Tanpenshuu, volume $1")
      .replace(/Re:\s*Zero\s+Prequel\s*:/gi, english ? "Re:Zero prequel:" : "Prequela de Re:Zero:")
      .replace(/\bArc\s+(\d+)/gi, english ? "Arc $1" : "Arco $1")
      .replace(/\bPage\s+(\d+)/gi, english ? "Page $1" : "Página $1")
      .replace(/\bEpisode\s+(\d+)/gi, english ? "Episode $1" : "Episódio $1")
      .replace(/\bside story\b/gi, english ? "side story" : "história paralela");
    return this.translateHintNotes(text);
  }

  translateHairColor(str) {
    const colors = [
      ["transparent golden blonde", "loiro dourado transparente"],
      ["blackish brown", "castanho-escuro"],
      ["chestnut brown", "castanho"],
      ["charred brown", "castanho queimado"],
      ["cream blonde", "loiro creme"],
      ["purplish black", "preto arroxeado"],
      ["flaming red", "vermelho vivo"],
      ["dark green", "verde-escuro"],
      ["dark brown", "castanho-escuro"],
      ["dark blue", "azul-escuro"],
      ["light purple", "roxo-claro"],
      ["indigo blue", "azul-índigo"],
      ["ashen grey", "cinza-claro"],
      ["ashen gray", "cinza-claro"],
      ["sky blue", "azul-celeste"],
      ["pale gold", "dourado-claro"],
      ["pale red", "vermelho-claro"],
      ["platinum", "platinado"],
      ["silver", "prateado"],
      ["blonde", "loiro"],
      ["brown", "castanho"],
      ["black", "preto"],
      ["white", "branco"],
      ["orange", "laranja"],
      ["purple", "roxo"],
      ["indigo", "índigo"],
      ["auburn", "ruivo"],
      ["green", "verde"],
      ["grey", "cinza"],
      ["gray", "cinza"],
      ["gold", "dourado"],
      ["pink", "rosa"],
      ["blue", "azul"],
      ["red", "vermelho"],
    ];
    let text = str;
    if (/unknown/i.test(text)) return t("unknown");
    if (getLang() === "en") {
      text = this.translateHintNotes(text);
      return text.charAt(0).toUpperCase() + text.slice(1);
    }
    for (const [en, pt] of colors) {
      text = text.replace(new RegExp(`\\b${en}\\b`, "gi"), pt);
    }
    text = this.translateHintNotes(text);
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  translateHintNotes(str) {
    if (getLang() === "en") return str;
    const notes = [
      ["most commonly seen", "aparência mais comum"],
      ["side story", "história paralela"],
      ["light novel", "light novel"],
      ["silhouette", "silhueta"],
      ["flashback", "retrospectiva"],
      ["mentioned", "mencionado"],
      ["appearance", "aparição"],
      ["variable", "variável"],
      ["current", "atual"],
      ["actual", "aparição"],
      ["cameo", "participação"],
      ["past", "passado"],
    ];
    let text = str
      .replace(/\(anime\)/gi, "(no anime)")
      .replace(/\(light novel\)/gi, "(na light novel)");
    for (const [en, pt] of notes) {
      text = text.replace(new RegExp(`\\b${en}\\b`, "gi"), pt);
    }
    return text;
  }

  translate(val, type = "default", charName = "") {
    if (
      type === "magic" &&
      (charName.includes("Julius") || charName.includes("Arakiya"))
    ) {
      return t("allMagic");
    }

    if (
      !val ||
      val === "N/A" ||
      val === "" ||
      val.toLowerCase().includes("unknown") ||
      val.toLowerCase() === "none"
    ) {
      return type === "binary" ? t("no") : t("unknown");
    }

    if (type === "magic") {
      const allowedMagics = [
        { en: "Fire Magic", pt: "Fogo" },
        { en: "Water Magic", pt: "Água" },
        { en: "Wind Magic", pt: "Vento" },
        { en: "Earth Magic", pt: "Terra" },
        { en: "Yin Magic", pt: "Yin" },
        { en: "Yang Magic", pt: "Yang" },
      ];
      const english = getLang() === "en";
      let found = allowedMagics
        .filter((m) => val.toLowerCase().includes(m.en.toLowerCase()))
        .map((m) => (english ? m.en.replace(" Magic", "") : m.pt));
      return found.length > 0 ? found.join(", ") : t("unknown");
    }

    if (getLang() === "en") return val;

    const words = {
      Male: "Masculino",
      Female: "Feminino",
      Human: "Humano",
      Spirit: "Espírito",
      Oni: "Oni",
    };
    return val
      .split(",")
      .map((item) => words[item.trim()] || item.trim())
      .join(", ");
  }

  async loadCharacters() {
    if (this.cachedList.length > 0) return this.cachedList;
    let allTitles = [],
      cmcontinue = "";
    do {
      const url = `${this.wikiApi}?action=query&list=categorymembers&cmtitle=Category:Characters&cmtype=page&cmlimit=500&format=json&origin=*${cmcontinue ? `&cmcontinue=${cmcontinue}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.query)
        allTitles = allTitles.concat(
          data.query.categorymembers.map((c) => c.title),
        );
      cmcontinue = data.continue ? data.continue.cmcontinue : null;
    } while (cmcontinue);
    allTitles = allTitles.filter((title) => this.isSelectableCharacter(title));
    await this.fetchImages(allTitles);
    this.cachedList = allTitles;
    return allTitles;
  }

  /** Páginas-índice da wiki, não personagens. */
  isSelectableCharacter(title) {
    return title !== "Characters" && title !== "Minor Characters";
  }

  extractAnimeField(wikitext) {
    const match = wikitext.match(/\|Anime\s*=\s*([\s\S]*?)(?=\n\s*\||\}\})/i);
    return match ? match[1].trim() : "";
  }

  /** Estreia de verdade no anime. Só "mentioned" não conta como aparição. */
  appearedInAnime(raw) {
    if (!raw) return false;
    const clean = raw
      .replace(/<ref[\s\S]*?<\/ref>/gi, "")
      .replace(/\{\{[\s\S]*?\}\}/g, "")
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]+)\]\]/g, "$1")
      .replace(/<br\s*\/?>/gi, "\n")
      .trim();
    if (!clean || /^(n\/a|unknown|none|-+)$/i.test(clean)) return false;
    const parts = clean
      .split("\n")
      .map((part) => part.trim())
      .filter((part) => /episode/i.test(part));
    return parts.some((part) => !/\(mentioned\)/i.test(part));
  }

  async loadAnimeNames() {
    if (this.animeSet) return this.animeSet;
    const all = await this.loadCharacters();
    const names = new Set();
    for (let i = 0; i < all.length; i += 25) {
      const chunk = all.slice(i, i + 25);
      const res = await fetch(
        `${this.wikiApi}?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(chunk.join("|"))}&format=json&origin=*`,
      );
      const data = await res.json();
      const pages = data.query?.pages || {};
      for (const id in pages) {
        const page = pages[id];
        const text = page.revisions?.[0]?.slots?.main?.["*"] || "";
        if (text) this.wikitextCache.set(page.title, text);
        if (page.title && this.appearedInAnime(this.extractAnimeField(text))) {
          names.add(page.title);
        }
      }
    }
    this.animeSet = names;
    return names;
  }

  async getPlayableCharacters() {
    const all = await this.loadCharacters();
    if (getMode() !== "anime") return all;
    const anime = await this.loadAnimeNames();
    return all.filter((name) => anime.has(name));
  }

  async fetchImages(titles) {
    for (let i = 0; i < titles.length; i += 50) {
      const chunk = titles.slice(i, i + 50).join("|");
      const res = await fetch(
        `${this.wikiApi}?action=query&titles=${encodeURIComponent(chunk)}&prop=pageimages&pithumbsize=250&format=json&origin=*`,
      );
      const data = await res.json();
      const pages = data.query.pages;
      for (const id in pages) {
        const p = pages[id];
        this.imageMap[p.title] = p.thumbnail
          ? p.thumbnail.source.split("/revision/latest")[0]
          : "https://static.wikia.nocookie.net/rezero/images/e/e6/Site-logo.png";
      }
    }
  }

  async loadCharacterStats(name) {
    const cacheKey = `${getLang()}:${name}`;
    if (this.statsCache.has(cacheKey)) return this.statsCache.get(cacheKey);

    let wikitext = this.wikitextCache.get(name);
    if (!wikitext) {
      const res = await fetch(
        `${this.wikiApi}?action=parse&page=${encodeURIComponent(name)}&prop=wikitext&format=json&origin=*`,
      );
      const data = await res.json();
      if (!data.parse) return null;
      wikitext = data.parse.wikitext["*"];
      this.wikitextCache.set(name, wikitext);
    }

    const getField = (f) => {
      const r = new RegExp(
        `\\|${f}\\s*=\\s*([\\s\\S]*?)(?=\\n\\s*\\||\\||\\}\\})`,
        "i",
      );
      const m = wikitext.match(r);
      return m ? m[1].trim() : "N/A";
    };

    const processDeepAff = (str) => {
      if (!str || str === "N/A") return [];
      let canonText = str.split(/\{\{Expand/i)[0].split(/Show non-canon/i)[0];
      let parts = new Set();
      const linkRegex = /\[\[(.*?)\]\]/g;
      let match;
      while ((match = linkRegex.exec(canonText)) !== null) {
        let inner = match[1];
        let displayName = inner.includes("|")
          ? inner.split("|").pop()
          : inner.includes("#")
            ? inner.split("#").pop()
            : inner;
        parts.add(displayName.trim());
      }
      const outside = canonText
        .replace(/\[\[.*?\]\]/g, "")
        .split(/[,\n]|<br\s*\/?>/);
      outside.forEach((item) => {
        let cleaned = item
          .replace(/[{}[\]]/g, "")
          .replace(/#/g, "")
          .trim();
        if (cleaned && cleaned.toLowerCase() !== "expand" && cleaned !== "")
          parts.add(cleaned);
      });
      return Array.from(parts);
    };

    const currentAff = processDeepAff(getField("Affiliation"));
    const prevAff = processDeepAff(getField("Previous Affiliation"));
    const finalAff = currentAff.length > 0 ? currentAff : prevAff;

    // Limpa o status de referências da Wiki antes de traduzir
    const rawStatus = getField("Status")
      .replace(/<ref.*?>.*?<\/ref>/g, "")
      .trim();

    const stats = {
      Character: name,
      // 1. Usa o novo dicionário de Gênero
      Gender: this.translateGender(getField("Gender")),

      // 2. Usa o novo dicionário de Raça e trata múltiplos valores (ex: "Elf, Spirit")
      Race:
        getField("Race") !== "N/A"
          ? getField("Race")
              .split(",")
              .map((r) => this.translateRace(r))
              .join(", ")
          : t("unknown"),

      Height: this.extractHeight(getField("Height")),

      // 3. Usa o novo dicionário de Status
      Status: this.translateStatus(rawStatus),

      Age: this.extractAge(getField("Age"), name),

      // 4. Afiliação já estava correta chamando o seu mapa
      Afiliation:
        finalAff.length > 0
          ? finalAff.map((s) => this.translateAffiliation(s)).join("<br>")
          : t("unknown"),

      AfiliationArray: finalAff.map((s) => s.toLowerCase()),
      Elemental: this.translate(getField("Magic"), "magic", name),
      Protection: getField("Divine Protection").length > 5 ? t("yes") : t("no"),
      Authority: getField("Authority").length > 5 ? t("yes") : t("no"),
      Image: this.imageMap[name],
      DebutLN: this.translateHint(getField("Light Novel"), "debut"),
      DebutAnime: this.translateHint(getField("Anime"), "debut"),
      HairColor: this.translateHint(getField("Hair Color"), "hair"),
    };
    this.statsCache.set(cacheKey, stats);
    return stats;
  }

  async characterGuess(ansName, gName) {
    const a = await this.loadCharacterStats(ansName);
    const g = await this.loadCharacterStats(gName);
    if (!a || !g) return {};
    const isWinningGuess = ansName === gName;
    const res = {};
    const simpleFields = [
      "Gender",
      "Race",
      "Elemental",
      "Protection",
      "Authority",
      "Status",
    ];

    simpleFields.forEach((k) => {
      if (isWinningGuess) res[k] = "correct";
      else {
        const valA = a[k].toLowerCase();
        const valG = g[k].toLowerCase();
        res[k] =
          valA === valG
            ? "correct"
            : valA.includes(valG) || valG.includes(valA)
              ? "partial"
              : "incorrect";
      }
    });

    if (isWinningGuess) res.Afiliation = "correct";
    else {
      const hasCommon = a.AfiliationArray.some((aff) =>
        g.AfiliationArray.includes(aff),
      );
      const exactMatch =
        a.AfiliationArray.length === g.AfiliationArray.length &&
        a.AfiliationArray.every((aff) => g.AfiliationArray.includes(aff));
      if (exactMatch) res.Afiliation = "correct";
      else if (hasCommon) res.Afiliation = "partial";
      else res.Afiliation = "incorrect";
    }

    const compare = (vA, vG) => {
      if (isWinningGuess) return "correct";
      const nA = parseInt(vA.replace("+", ""));
      const nG = parseInt(vG.replace("+", ""));
      if (nA === nG) return "correct";
      if (isNaN(nA) || isNaN(nG) || nA === 0 || nG === 0) return "incorrect";
      return nA > nG ? "up" : "down";
    };

    res.AgeArrow = compare(a.Age, g.Age);
    res.HeightArrow = compare(a.Height, g.Height);
    res.Guess = isWinningGuess ? "correct" : "incorrect";
    return res;
  }

  /** Fisher-Yates com semente fixa: a mesma lista produz a mesma ordem para todos. */
  getShuffledList(list) {
    const normalized = list.slice().sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    const key = `${normalized.length}:${this.hashString(normalized.join("\u0000"))}`;
    if (key === this.cachedShuffleKey && this.cachedShuffled.length > 0) {
      return this.cachedShuffled;
    }
    const arr = normalized.slice();
    let s = (0x9e3779b9 ^ this.hashString("rezero-guesser-shuffle-v3")) | 0;
    const next = () => {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this.cachedShuffleKey = key;
    this.cachedShuffled = arr;
    return arr;
  }

  /**
   * Personagem do dia. Todos recebem o mesmo nome na mesma data, mas dias
   * consecutivos não seguem a ordem da wiki nem a ordem embaralhada.
   */
  pickCharacter(list, date = new Date()) {
    if (!list || list.length === 0) return null;
    const shuffled = this.getShuffledList(list);
    const length = shuffled.length;
    const step = this.dailyStep(length);
    const start = this.hashString("rezero-guesser-start-v3") % length;
    const index = this.mod(start + this.calendarDayIndex(date) * step, length);
    return shuffled[index];
  }

  async getCharacterForDay(offset = 0, now = new Date()) {
    const list = await this.getPlayableCharacters();
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return this.pickCharacter(list, date);
  }

  async getDailyCharacter() {
    return this.getCharacterForDay(0);
  }

  async getYesterdayCharacter() {
    return this.getCharacterForDay(-1);
  }
}
