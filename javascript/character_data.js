class CharacterData {
    constructor() {
        this.wikiApi = "https://rezero.fandom.com/api.php";
        this.imageMap = {};
        this.cachedList = [];
    }

    formatTitleCase(str) {
        if (!str) return "";
        return str.split(' ').map(word => {
            if (word.length === 0) return "";
            return word.charAt(0).toUpperCase() + word.slice(1);
        }).join(' ');
    }

    /**
     * Extrai o PRIMEIRO número encontrado (padrão de altura e idade base)
     */
    extractNumber(str) {
        if (!str || str === "N/A" || str === "Unknown" || str === "Desconhecido") return "0";
        const match = str.match(/\d+/);
        return match ? match[0] : "0";
    }

    translate(val, type = 'default') {
        if (!val || val === "N/A" || val === "" || val.toLowerCase() === "unknown" || val.toLowerCase() === "none") {
            return type === 'binary' ? "Não" : "Desconhecido";
        }

        if (type === 'magic') {
            const allowedMagics = [
                { en: "Fire Magic", pt: "Fogo" },
                { en: "Water Magic", pt: "Água" },
                { en: "Wind Magic", pt: "Vento" },
                { en: "Earth Magic", pt: "Terra" },
                { en: "Yin Magic", pt: "Yin" },
                { en: "Yang Magic", pt: "Yang" }
            ];
            let found = allowedMagics
                .filter(m => val.toLowerCase().includes(m.en.toLowerCase()))
                .map(m => m.pt);
            return found.length > 0 ? found.join(", ") : "Desconhecido";
        }

        const t = {
            "Male": "Masculino", "Female": "Feminino", "Human": "Humano",
            "Spirit": "Espírito", "Oni": "Oni", "Elf": "Elfo", "Half-Elf": "Meio-Elfo",
            "Dragon": "Dragão", "Beast": "Fera", "Giant": "Gigante",
            "Alive": "Vivo", "Deceased": "Morto"
        };
        return val.split(',').map(item => t[item.trim()] || item.trim()).join(', ');
    }

    async loadCharacters() {
        if (this.cachedList.length > 0) return this.cachedList;
        let allTitles = [], cmcontinue = "";
        do {
            const url = `${this.wikiApi}?action=query&list=categorymembers&cmtitle=Category:Characters&cmtype=page&cmlimit=500&format=json&origin=*${cmcontinue ? `&cmcontinue=${cmcontinue}` : ""}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.query && data.query.categorymembers) {
                allTitles = allTitles.concat(data.query.categorymembers.map(c => c.title));
            }
            cmcontinue = data.continue ? data.continue.cmcontinue : null;
        } while (cmcontinue);
        await this.fetchImages(allTitles);
        this.cachedList = allTitles;
        return allTitles;
    }

    async fetchImages(titles) {
        for (let i = 0; i < titles.length; i += 50) {
            const chunk = titles.slice(i, i + 50).join('|');
            const url = `${this.wikiApi}?action=query&titles=${encodeURIComponent(chunk)}&prop=pageimages&pithumbsize=250&format=json&origin=*`;
            const res = await fetch(url);
            const data = await res.json();
            const pages = data.query.pages;
            for (const id in pages) {
                const p = pages[id];
                let img = p.thumbnail ? p.thumbnail.source.split('/revision/latest')[0] : "https://static.wikia.nocookie.net/rezero/images/e/e6/Site-logo.png";
                this.imageMap[p.title] = img;
            }
        }
    }

    async loadCharacterStats(name) {
        const url = `${this.wikiApi}?action=parse&page=${encodeURIComponent(name)}&prop=wikitext&format=json&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        if (!data.parse) return null;
        const wikitext = data.parse.wikitext['*'];
        
        const getField = (f) => {
            const r = new RegExp(`\\|${f}\\s*=\\s*([\\s\\S]*?)(?=\\n\\s*\\||\\||\\}\\})`, "i");
            const m = wikitext.match(r);
            return m ? m[1].trim() : "N/A";
        };

        if (getField("Game").includes("Infinity") && !getField("Game").includes("Anime")) return null;

        /**
         * PROCESSO DE AFILIAÇÕES CORRIGIDO: 
         * Limpa hashtags e prioriza o rótulo/âncora do link.
         */
        const processDeepAff = (str) => {
            if (!str || str === "N/A" || str.toLowerCase() === "none") return [];
            
            // Ignora conteúdo não canônico
            let canonText = str.split(/\{\{Expand/i)[0].split(/Show non-canon/i)[0];
            let parts = new Set();
            
            // 1. Processa links [[...]]
            const linkRegex = /\[\[(.*?)\]\]/g;
            let match;
            while ((match = linkRegex.exec(canonText)) !== null) {
                let inner = match[1];
                let displayName = inner;

                if (inner.includes('|')) {
                    displayName = inner.split('|').pop(); // Pega o rótulo após o pipe
                } else if (inner.includes('#')) {
                    displayName = inner.split('#').pop(); // Pega a âncora após a hashtag
                }

                let cleaned = displayName.replace(/<.*?>/g, '').trim();
                if (cleaned && cleaned.toLowerCase() !== "expand") parts.add(cleaned);
            }

            // 2. Processa textos fora de links (Forbidden Library, etc.)
            const outside = canonText.replace(/\[\[.*?\]\]/g, '').split(/[,\n]|<br\s*\/?>/);
            outside.forEach(item => {
                // Remove qualquer símbolo residual de hashtag ou chaves
                let cleaned = item.replace(/[{}[\]]/g, '').replace(/#/g, '').trim();
                if (cleaned && cleaned.toLowerCase() !== "expand" && cleaned !== "") parts.add(cleaned);
            });

            return Array.from(parts);
        };

        const currentList = processDeepAff(getField("Affiliation"));
        const previousList = processDeepAff(getField("Previous Affiliation"));
        
        // Prioridade: Afiliação Atual. Se vazia, usa a Anterior completa.
        let finalArray = currentList.length > 0 ? currentList : previousList;
        
        let affDisplay = finalArray.length > 0 ? finalArray.map(s => this.formatTitleCase(s)).join("<br>") : "Desconhecido";
        let affArrayInternal = finalArray.map(s => s.toLowerCase());

        const validateBinary = (val) => {
            if (!val || val === "N/A") return "Não";
            let clean = val.replace(/<.*?>/g, '').replace(/<ref.*?>.*?<\/ref>/gi, '').replace(/\{\{.*?\}\}/g, '').replace(/[\[\]]/g, '').trim();
            const lower = clean.toLowerCase();
            return (lower === "none" || lower === "unknown" || clean === "") ? "Não" : "Sim";
        };

        return {
            Character: name,
            Gender: this.translate(getField("Gender"), 'biographic'),
            Race: this.translate(getField("Race"), 'biographic'),
            Height: this.extractNumber(getField("Height")),
            Status: this.translate(getField("Status"), 'biographic'),
            Age: this.extractNumber(getField("Age")),
            Afiliation: affDisplay,
            AfiliationArray: affArrayInternal,
            Elemental: this.translate(getField("Magic"), 'magic'),
            Protection: validateBinary(getField("Divine Protection")),
            Authority: validateBinary(getField("Authority")),
            Image: this.imageMap[name],
            DebutLN: getField("Light Novel").replace(/[\[\]]/g, '').trim(),
            DebutAnime: getField("Anime").replace(/[\[\]]/g, '').trim(),
            HairColor: this.formatTitleCase(getField("Hair Color").replace(/[\[\]]/g, '')),
            Occupation: this.formatTitleCase(getField("Occupation").replace(/[\[\]]/g, '')),
            Equipment: this.formatTitleCase(getField("Equipment").replace(/[\[\]]/g, ''))
        };
    }

    async characterGuess(ansName, gName) {
        const a = await this.loadCharacterStats(ansName);
        const g = await this.loadCharacterStats(gName);
        if (!a || !g) return {};
        const isWinningGuess = (ansName === gName);
        const res = {};
        const simpleFields = ['Gender', 'Race', 'Elemental', 'Protection', 'Authority', 'Status'];
        
        simpleFields.forEach(k => {
            if (isWinningGuess) res[k] = 'correct';
            else {
                const valA = a[k].toLowerCase();
                const valG = g[k].toLowerCase();
                res[k] = valA === valG ? 'correct' : (valA.includes(valG) || valG.includes(valA) ? 'partial' : 'incorrect');
            }
        });

        if (isWinningGuess) res.Afiliation = 'correct';
        else {
            const hasCommon = a.AfiliationArray.some(aff => g.AfiliationArray.includes(aff));
            const exactMatch = a.AfiliationArray.length === g.AfiliationArray.length && a.AfiliationArray.every(aff => g.AfiliationArray.includes(aff));
            if (exactMatch) res.Afiliation = 'correct';
            else if (hasCommon) res.Afiliation = 'partial';
            else res.Afiliation = 'incorrect';
        }

        const compare = (vA, vG) => {
            if (isWinningGuess) return 'correct';
            const nA = parseInt(vA), nG = parseInt(vG);
            if (nA === nG) return 'correct';
            if (nA === 0 || nG === 0) return 'incorrect';
            return nA > nG ? 'up' : 'down';
        };

        res.AgeArrow = compare(a.Age, g.Age);
        res.HeightArrow = compare(a.Height, g.Height);
        res.Guess = isWinningGuess ? 'correct' : 'incorrect';
        return res;
    }

    async getDailyCharacter() {
        const list = await this.loadCharacters();
        const seed = Math.floor(new Date().setHours(0,0,0,0) / 86400000);
        return list[seed % list.length];
    }

    async getYesterdayCharacter() {
        const list = await this.loadCharacters();
        const seed = Math.floor(new Date().setHours(0,0,0,0) / 86400000) - 1;
        return list[seed % list.length];
    }
}