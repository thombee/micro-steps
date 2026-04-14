import confetti from 'canvas-confetti';

function floatEmojis(emojis) {
  for (let i = 0; i < 9; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      const size = 22 + Math.random() * 22;
      el.style.cssText = `
        position:fixed;
        font-size:${size}px;
        left:${8 + Math.random() * 84}%;
        bottom:15%;
        z-index:9999;
        pointer-events:none;
        user-select:none;
        animation:celebFloat ${1.2 + Math.random() * 0.6}s ease-out forwards;
      `;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 2000);
    }, i * 70);
  }
}

const effects = [
  // 1 — Classic confetti shower
  () => confetti({ particleCount: 90, spread: 65, origin: { y: 0.6 } }),

  // 2 — Fireworks: three sequential pops
  () => {
    const pop = (x, y, delay) => setTimeout(() =>
      confetti({ particleCount: 45, spread: 80, origin: { x, y }, startVelocity: 28 }), delay);
    pop(0.3, 0.55, 0);
    pop(0.7, 0.45, 220);
    pop(0.5, 0.65, 440);
  },

  // 3 — Gold stars
  () => confetti({
    particleCount: 65,
    spread: 70,
    shapes: ['star'],
    colors: ['#FFD700', '#FFA500', '#FFEC3D', '#FFB300'],
    origin: { y: 0.6 },
  }),

  // 4 — Side cannons
  () => {
    confetti({ particleCount: 55, angle: 60, spread: 55, origin: { x: 0, y: 0.65 } });
    confetti({ particleCount: 55, angle: 120, spread: 55, origin: { x: 1, y: 0.65 } });
  },

  // 5 — Party emoji float
  () => floatEmojis(['🎉', '✨', '⭐', '💪', '🔥', '🎊', '🌟', '💫', '🙌']),

  // 6 — Rainbow cascade from top
  () => confetti({
    particleCount: 110,
    spread: 100,
    origin: { y: 0.2 },
    gravity: 0.55,
    colors: ['#ff0000', '#ff7700', '#ffff00', '#00cc00', '#0088ff', '#8800ff'],
  }),

  // 7 — Gold coin burst (large circles)
  () => confetti({
    particleCount: 70,
    spread: 55,
    shapes: ['circle'],
    colors: ['#FFD700', '#FFC000', '#FFAA00', '#FFE066'],
    scalar: 1.6,
    origin: { y: 0.55 },
  }),

  // 8 — Sparkle (two waves of tiny white stars)
  () => {
    const opts = { shapes: ['star'], colors: ['#ffffff', '#d4d4d4', '#e8e8ff'], scalar: 0.65 };
    confetti({ ...opts, particleCount: 35, spread: 45, origin: { y: 0.5 } });
    setTimeout(() => confetti({ ...opts, particleCount: 35, spread: 65, origin: { y: 0.65 } }), 180);
  },

  // 9 — Heart emoji float
  () => floatEmojis(['❤️', '🧡', '💛', '💚', '💙', '💜', '🩷', '🤍', '💖']),

  // 10 — Brand burst (purple + pink opposing volleys)
  () => {
    confetti({ particleCount: 45, spread: 75, colors: ['#4F46E5', '#818CF8', '#6366f1'], origin: { x: 0.35, y: 0.6 } });
    confetti({ particleCount: 45, spread: 75, colors: ['#EC4899', '#F9A8D4', '#db2777'], origin: { x: 0.65, y: 0.6 } });
  },
];

let lastIndex = -1;

export function fireCelebration() {
  // Pick a random effect, avoid repeating the same one twice in a row
  let idx;
  do { idx = Math.floor(Math.random() * effects.length); } while (idx === lastIndex);
  lastIndex = idx;
  effects[idx]();
}
