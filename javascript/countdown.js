function countdownTimer() {
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    if (!hoursEl) return;

    setInterval(() => {
        const now = new Date();
        const nextDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0);
        const diff = nextDay - now;

        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        hoursEl.innerText = String(h).padStart(2, '0');
        minutesEl.innerText = String(m).padStart(2, '0');
        secondsEl.innerText = String(s).padStart(2, '0');
    }, 1000);
}
countdownTimer();