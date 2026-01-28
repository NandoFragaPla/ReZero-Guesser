import { affiliationsMap } from "./character_afiliation_data.js";
import { gendersMap } from "./character_gender_data.js";
import { racesMap } from "./character_race_data.js";
import { statusMap } from "./character_status_data.js";

export class CharacterData {
  constructor() {
    this.wikiApi = "https://rezero.fandom.com/api.php";
    this.imageMap = {};
    this.cachedList = [];
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
    return affiliationsMap[formattedName] || formattedName;
  }

  translateRace(name) {
    const formattedName = this.formatTitleCase(name.trim());
    return racesMap[formattedName] || formattedName;
  }

  translateGender(name) {
    const formattedName = this.formatTitleCase(name.trim());
    return gendersMap[formattedName] || formattedName;
  }

  translateStatus(name) {
    if (!name) return "Desconhecido";
    const clean = name.trim().replace(/<ref.*?>.*?<\/ref>/g, "");
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
    if (charName.includes("Roswaal K.")) return "Desconhecida";
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

  translate(val, type = "default", charName = "") {
    if (
      type === "magic" &&
      (charName.includes("Julius") || charName.includes("Arakiya"))
    ) {
      return "Todos os elementos (via espíritos)";
    }

    if (
      !val ||
      val === "N/A" ||
      val === "" ||
      val.toLowerCase().includes("unknown") ||
      val.toLowerCase() === "none"
    ) {
      return type === "binary" ? "Não" : "Desconhecido";
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
      let found = allowedMagics
        .filter((m) => val.toLowerCase().includes(m.en.toLowerCase()))
        .map((m) => m.pt);
      return found.length > 0 ? found.join(", ") : "Desconhecido";
    }

    const t = {
      Male: "Masculino",
      Female: "Feminino",
      Human: "Humano",
      Spirit: "Espírito",
      Oni: "Oni",
    };
    return val
      .split(",")
      .map((item) => t[item.trim()] || item.trim())
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
    await this.fetchImages(allTitles);
    this.cachedList = allTitles;
    return allTitles;
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
    const res = await fetch(
      `${this.wikiApi}?action=parse&page=${encodeURIComponent(name)}&prop=wikitext&format=json&origin=*`,
    );
    const data = await res.json();
    if (!data.parse) return null;
    const wikitext = data.parse.wikitext["*"];

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

    return {
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
          : "Desconhecido",

      Height: this.extractHeight(getField("Height")),

      // 3. Usa o novo dicionário de Status
      Status: this.translateStatus(rawStatus),

      Age: this.extractAge(getField("Age"), name),

      // 4. Afiliação já estava correta chamando o seu mapa
      Afiliation:
        finalAff.length > 0
          ? finalAff.map((s) => this.translateAffiliation(s)).join("<br>")
          : "Desconhecido",

      AfiliationArray: finalAff.map((s) => s.toLowerCase()),
      Elemental: this.translate(getField("Magic"), "magic", name),
      Protection: getField("Divine Protection").length > 5 ? "Sim" : "Não",
      Authority: getField("Authority").length > 5 ? "Sim" : "Não",
      Image: this.imageMap[name],
      DebutLN: getField("Light Novel").replace(/[\[\]]/g, ""),
      DebutAnime: getField("Anime").replace(/[\[\]]/g, ""),
      HairColor: getField("Hair Color").replace(/[\[\]]/g, ""),
    };
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

  async getDailyCharacter() {
    const list = await this.loadCharacters();
    const seed = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000);
    return list[seed % list.length];
  }

  async getYesterdayCharacter() {
    const list = await this.loadCharacters();
    const seed = Math.floor(new Date().setHours(0, 0, 0, 0) / 86400000) - 1;
    return list[seed % list.length];
  }
}
