// Adicione esta linha no TOPO do options_logic.js
import { CharacterData } from "./character_data.js";
import { format, getLang, setLang, t } from "./i18n.js";

const guessbox = document.querySelector(".guessbox"), options = guessbox.querySelector(".options"), searchInp = guessbox.querySelector("input");
const btnHint = document.getElementById("btn-hint"), hintDisplay = document.getElementById("hint-display");
const charCountDiv = document.getElementById('char-count');

let characters = [], answer, CD, alreadyChosen = [];
let uiPhase = "loading";
let popupMode = null;

window.onload = async () => {
    try {
        CD = new CharacterData();
        uiPhase = "loading";
        searchInp.placeholder = t("loading");
        
        // Carrega a lista principal
        await CD.loadCharacters();
        characters = CD.cachedList;

        // Atualiza o contador na tela usando a lista que já baixamos
        if (charCountDiv) {
            charCountDiv.innerText = format("count", { n: characters.length });
        }

        // Define o personagem do dia e de ontem
        answer = await CD.loadCharacterStats(await CD.getDailyCharacter());
        const yesterdayStats = await CD.loadCharacterStats(await CD.getYesterdayCharacter());
        
        displayYesterdayCharacter(yesterdayStats);
        populateFullList();

        uiPhase = "ready";
        searchInp.placeholder = t("typeName");
        searchInp.disabled = false;

        if(btnHint) {
            btnHint.style.display = "none";
            btnHint.onclick = () => revealHint();
        }
        startCountdown();
        
    } catch (error) {
        console.error("Erro ao carregar dados da Wiki:", error);
        uiPhase = "error";
        searchInp.placeholder = t("loadError");
    } finally {
        hideLoader();
    }
};

function hideLoader() {
    const loader = document.getElementById("loading-overlay");
    if (loader) loader.style.display = "none";
}

//Essa função exibe o personagem de ontem
function displayYesterdayCharacter(stats) {
    const row = document.getElementById('yesterday-row');
    if (stats && row) {
        document.getElementById('yesterday-img').src = stats.Image;
        document.getElementById('yesterday-name').innerText = stats.Character;
        row.style.display = 'flex';
    }
}

//Essa função inicia a contagem regressiva para o próximo personagem
function startCountdown() {
    const hoursEl = document.getElementById('hours'), minutesEl = document.getElementById('minutes'), secondsEl = document.getElementById('seconds');
    function update() {
        const now = new Date(), tomorrow = new Date();
        tomorrow.setHours(24, 0, 0, 0);
        const diff = tomorrow - now;
        if (diff <= 0) { location.reload(); return; }
        hoursEl.innerText = String(Math.floor(diff / 3600000)).padStart(2, '0');
        minutesEl.innerText = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
        secondsEl.innerText = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
    }
    update(); setInterval(update, 1000);
}

//Essa função revela dicas baseadas na quantidade de erros do jogador
function revealHint() {
    if(!hintDisplay) return;
    
    hintDisplay.style.display = "block";
    let hintParts = [];
    const count = alreadyChosen.length;

    // Dica 1: Estreia (Liberada com 3 ou mais erros)
    if (count >= 3) {
        if (answer.DebutLN && answer.DebutLN !== "N/A") hintParts.push(`<strong>Light Novel:</strong> ${answer.DebutLN}`);
        if (answer.DebutAnime && answer.DebutAnime !== "N/A") hintParts.push(`<strong>Anime:</strong> ${answer.DebutAnime}`);
    }

    // Dica 2: Aparência (Liberada com 6 ou mais erros)
    if (count >= 6) {
        let hair = (answer.HairColor && answer.HairColor !== "N/A") ? answer.HairColor : t("unknown");
        hintParts.push(`<strong>${t("hintHair")}:</strong> ${hair}`);
    }

    // Dica 3: Informação Extra (Liberada com 9 ou mais erros)
    if (count >= 9) {
        let extra = "";
        if (answer.Afiliation && answer.Afiliation !== t("unknown")) {
            extra = `<strong>${t("hintAffiliation")}:</strong> ${answer.Afiliation.replace(/<br>/g, ', ')}`;
        } else if (answer.Occupation && answer.Occupation !== "N/A") {
            extra = `<strong>${t("hintJob")}:</strong> ${answer.Occupation}`;
        } else if (answer.Equipment && answer.Equipment !== "N/A") {
            extra = `<strong>${t("hintGear")}:</strong> ${answer.Equipment}`;
        } else {
            extra = `<strong>${t("hintExtra")}:</strong> N/A`;
        }
        hintParts.push(extra);
    }

    hintDisplay.innerHTML = hintParts.join("<br>");

    // Esconde o botão definitivamente quando todas as dicas já foram reveladas
    if (count >= 9 && btnHint) {
        btnHint.style.display = "none";
    }
}
//Essa função popula a lista completa de personagens
function populateFullList() {
    if (!options) return;
    options.innerHTML = '';
    
    characters.forEach(char => {
        if (alreadyChosen.includes(char)) return;
        const div = document.createElement('div');
        div.className = 'character-item';
        div.dataset.name = char.toLowerCase();
        
        // Verifica se a imagem existe no mapa para não quebrar o render
        const imgUrl = CD.imageMap[char] || "https://static.wikia.nocookie.net/rezero/images/e/e6/Site-logo.png";
        
        div.innerHTML = `<button class="character-select">
            <div><img src="${imgUrl}" style="width:40px; height:40px; object-fit:cover; object-position: top; border-radius:4px;"></div>
            <div class="char-name">${char}</div>
        </button>`;
        div.onclick = () => makeGuess(char);
        options.appendChild(div);
    });
}
//Essa função filtra a lista de personagens conforme o usuário digita
searchInp.onkeyup = () => {
    const val = searchInp.value.toLowerCase();
    const items = options.querySelectorAll('.character-item');
    items.forEach(item => item.style.display = (val === "" || item.dataset.name.includes(val)) ? "block" : "none");
    options.style.display = val !== "" ? 'block' : 'none';
};
//Essa função processa o palpite do usuário
async function makeGuess(name) {
    if (alreadyChosen.length >= 10) return; // Não permite mais palpites
    const stats = await CD.loadCharacterStats(name);
    if (!stats) return;
    alreadyChosen.push(name);
    if (alreadyChosen.length >= 3 && btnHint && hintDisplay.style.display !== "block") btnHint.style.display = "block";
    if (hintDisplay.style.display === "block") revealHint();
    searchInp.value = ''; options.style.display = 'none';
    populateFullList();
    const result = await CD.characterGuess(answer.Character, name);
    renderGuessResult(result, stats);
    // Se chegou a 10 palpites e não acertou, termina o jogo
    if (alreadyChosen.length >= 10 && result.Guess !== 'correct') {
        triggerLose();
    }
}
// Função para exibir popup de derrota
function triggerLose() {
    const popup = document.getElementById('win-popup');
    popupMode = "lose";
    popup.querySelector('.win-answer-text').innerText = t("youLost");
    popup.querySelector('.win-answer-name').innerText = answer.Character;
    popup.querySelector('#win-char-img').src = answer.Image;
    popup.querySelector('#try-count').innerText = alreadyChosen.length;
    popup.style.display = 'flex';
    document.querySelector('.guessbox').style.display = 'none';
}
//Essa função renderiza o resultado do palpite do usuário
function renderGuessResult(res, stats, options = {}) {
    const container = document.querySelector(".user-answer");
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'square-container';
    const data = [
        { type: 'img', val: stats.Image, charName: stats.Character, status: res.Guess },
        { status: res.Gender, val: stats.Gender }, { status: res.Race, val: stats.Race },
        { status: res.HeightArrow === 'correct' ? 'correct' : 'incorrect', val: stats.Height + "cm", arrow: res.HeightArrow },
        { status: res.Status, val: stats.Status },
        { status: res.AgeArrow === 'correct' ? 'correct' : 'incorrect', val: stats.Age, arrow: res.AgeArrow },
        { status: res.Afiliation, val: stats.Afiliation }, 
        { status: res.Elemental, val: stats.Elemental },
        { status: res.Protection, val: stats.Protection }, 
        { status: res.Authority, val: stats.Authority }
    ];
    data.forEach((item, i) => {
        const square = document.createElement('div');
        const arrowClass = (item.arrow && item.arrow !== 'correct') ? `square-${item.arrow}` : '';
        const statusClass = item.status || 'none';
        square.className = `square square-answer-tile box-animation active guess-${statusClass} ${arrowClass}`;
        const isUnknown = (item.val === "0" || item.val === "0cm" || item.val === t("unknown"));
        const content = isUnknown ? "Desconhecido" : item.val;
        if (item.type === 'img') {
            const firstName = item.charName.split(' ')[0];
            square.innerHTML = `<div class="square-content"><img src="${item.val}" style="width:100%; height:100%; object-fit:cover; object-position: top;"><span class="char-name-overlay">${firstName}</span></div>`;
        } else {
            square.innerHTML = `<div class="square-content">${content}</div>`;
        }
        row.appendChild(square);
        setTimeout(() => square.classList.remove('active'), i * 80);
    });
    container.prepend(row);
    if (res.Guess === 'correct' && options.celebrate !== false) triggerWin(stats);
}
//Essa função exibe o popup de vitória
function triggerWin(stats) {
    popupMode = "win";
    const popup = document.getElementById('win-popup');
    document.getElementById('win-char-img').src = stats.Image;
    document.getElementById('win-char-name').innerText = stats.Character;
    applyTries(alreadyChosen.length);
    document.querySelector(".win-answer-text").innerText = t("youGuessed");
    popup.style.display = 'flex';
    document.querySelector('.guessbox').style.display = 'none';
}

//Mostra a quantidade de personagens carregados da wiki na tela, quando a lista de personagens carregar
async function updateCharacterCount() {
    const CDtemp = new CharacterData();
    await CDtemp.loadCharacters();
    const count = CDtemp.cachedList.length;
    if (charCountDiv) {
        charCountDiv.innerText = format("count", { n: count });
    }
}
updateCharacterCount();

function applyTries(count) {
    const line = document.querySelector(".nb-trys");
    if (!line) return;
    line.innerHTML = format("tries", { n: `<span id="try-count">${count}</span>` });
}

function applyI18n() {
    document.documentElement.lang = getLang() === "en" ? "en" : "pt-BR";
    document.querySelectorAll("[data-i18n]").forEach((el) => {
        if (el.id === "btn-close" || el.classList.contains("win-answer-text")) return;
        el.textContent = t(el.dataset.i18n);
    });
    if (popupMode === "win") document.querySelector(".win-answer-text").textContent = t("youGuessed");
    if (popupMode === "lose") document.querySelector(".win-answer-text").textContent = t("youLost");
    document.getElementById("btn-close").textContent = t("close");
    const tryCount = document.getElementById("try-count");
    applyTries(tryCount ? tryCount.textContent : 0);
    if (charCountDiv && characters.length) {
        charCountDiv.innerText = format("count", { n: characters.length });
    }
    if (uiPhase === "loading") searchInp.placeholder = t("loading");
    else if (uiPhase === "error") searchInp.placeholder = t("loadError");
    else searchInp.placeholder = t("typeName");
    document.querySelectorAll(".lang-btn").forEach((btn) => {
        const active = btn.dataset.lang === getLang();
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", active ? "true" : "false");
    });
}

async function changeLanguage(next) {
    if (next === getLang()) return;
    setLang(next);
    applyI18n();
    if (!CD || !answer) return;
    const names = alreadyChosen.slice();
    answer = await CD.loadCharacterStats(answer.Character);
    const box = document.querySelector(".user-answer");
    if (box) box.innerHTML = "";
    for (const name of names) {
        const stats = await CD.loadCharacterStats(name);
        const result = await CD.characterGuess(answer.Character, name);
        renderGuessResult(result, stats, { celebrate: false });
    }
    if (hintDisplay && hintDisplay.style.display === "block") revealHint();
}

document.querySelectorAll(".lang-btn").forEach((btn) => {
    btn.onclick = () => changeLanguage(btn.dataset.lang);
});

applyI18n();


//Eventos para abrir e fechar a lista de opções
document.addEventListener('click', (e) => { if (!guessbox.contains(e.target)) options.style.display = 'none'; });
searchInp.onfocus = () => { if(searchInp.value !== "") options.style.display = 'block'; };