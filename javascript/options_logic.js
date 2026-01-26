const guessbox = document.querySelector(".guessbox"), options = guessbox.querySelector(".options"), searchInp = guessbox.querySelector("input");
const btnHint = document.getElementById("btn-hint"), hintDisplay = document.getElementById("hint-display");
let characters = [], answer, CD, alreadyChosen = [];

window.onload = async () => {
    CD = new CharacterData();
    searchInp.placeholder = "Carregando Wiki...";
    await CD.loadCharacters();
    characters = CD.cachedList;
    answer = await CD.loadCharacterStats(await CD.getDailyCharacter());
    const yesterdayStats = await CD.loadCharacterStats(await CD.getYesterdayCharacter());
    displayYesterdayCharacter(yesterdayStats);
    populateFullList();
    searchInp.placeholder = "Digite o nome aqui...";
    searchInp.disabled = false;
    if(btnHint) {
        btnHint.style.display = "none";
        btnHint.onclick = () => revealHint();
    }
    startCountdown();
};

function displayYesterdayCharacter(stats) {
    const row = document.getElementById('yesterday-row');
    if (stats && row) {
        document.getElementById('yesterday-img').src = stats.Image;
        document.getElementById('yesterday-name').innerText = stats.Character;
        row.style.display = 'flex';
    }
}

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

function revealHint() {
    hintDisplay.style.display = "block";
    let hintParts = [];
    const count = alreadyChosen.length;
    if (count >= 3) {
        if (answer.DebutLN && answer.DebutLN !== "N/A") hintParts.push(`<strong>Light Novel:</strong> ${answer.DebutLN}`);
        if (answer.DebutAnime && answer.DebutAnime !== "N/A") hintParts.push(`<strong>Anime:</strong> ${answer.DebutAnime}`);
    }
    if (count >= 6) {
        let hair = (answer.HairColor && answer.HairColor !== "N/A") ? answer.HairColor : "N/A";
        hintParts.push(`<strong>Cabelo:</strong> ${hair}`);
    }
    if (count >= 9) {
        let extra = "";
        if (answer.Afiliation && answer.Afiliation !== "Desconhecido") extra = `<strong>Afiliação:</strong> ${answer.Afiliation.replace(/<br>/g, ', ')}`;
        else if (answer.Occupation && answer.Occupation !== "N/A") extra = `<strong>Ocupação:</strong> ${answer.Occupation}`;
        else if (answer.Equipment && answer.Equipment !== "N/A") extra = `<strong>Equipamento:</strong> ${answer.Equipment}`;
        else extra = `<strong>Extra:</strong> N/A`;
        hintParts.push(extra);
    }
    hintDisplay.innerHTML = hintParts.join("<br>");
    if (count >= 9) btnHint.style.display = "none";
}

function populateFullList() {
    options.innerHTML = '';
    characters.forEach(char => {
        if (alreadyChosen.includes(char)) return;
        const div = document.createElement('div');
        div.className = 'character-item';
        div.dataset.name = char.toLowerCase();
        div.innerHTML = `<button class="character-select">
            <div><img src="${CD.imageMap[char]}" style="width:40px; height:40px; object-fit:cover; object-position: top; border-radius:4px;"></div>
            <div class="char-name">${char}</div>
        </button>`;
        div.onclick = () => makeGuess(char);
        options.appendChild(div);
    });
}

searchInp.onkeyup = () => {
    const val = searchInp.value.toLowerCase();
    const items = options.querySelectorAll('.character-item');
    items.forEach(item => item.style.display = (val === "" || item.dataset.name.includes(val)) ? "block" : "none");
    options.style.display = val !== "" ? 'block' : 'none';
};

async function makeGuess(name) {
    const stats = await CD.loadCharacterStats(name);
    if (!stats) return;
    alreadyChosen.push(name);
    if (alreadyChosen.length >= 3 && btnHint && hintDisplay.style.display !== "block") btnHint.style.display = "block";
    if (hintDisplay.style.display === "block") revealHint();
    searchInp.value = ''; options.style.display = 'none';
    populateFullList();
    const result = await CD.characterGuess(answer.Character, name);
    renderGuessResult(result, stats);
}

function renderGuessResult(res, stats) {
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
        let statusClass = item.status || 'none';
        if (item.type === 'img' && statusClass === 'incorrect') statusClass = 'none';
        square.className = `square square-answer-tile box-animation active guess-${statusClass} ${arrowClass}`;
        const isUnknown = (item.val === "0" || item.val === "0cm" || item.val === "Desconhecido");
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
    if (res.Guess === 'correct') triggerWin(stats);
}

function triggerWin(stats) {
    const popup = document.getElementById('win-popup');
    document.getElementById('win-char-img').src = stats.Image;
    document.getElementById('win-char-name').innerText = stats.Character;
    document.getElementById('try-count').innerText = alreadyChosen.length;
    popup.style.display = 'flex';
    document.querySelector('.guessbox').style.display = 'none';
}

document.addEventListener('click', (e) => { if (!guessbox.contains(e.target)) options.style.display = 'none'; });
searchInp.onfocus = () => { if(searchInp.value !== "") options.style.display = 'block'; };