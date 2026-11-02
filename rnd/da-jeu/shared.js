// Throwaway mockup: the Play screen and the opening of a pack, shared by the three directions.
// Each page sets window.DA (particles, ambient) and its own stylesheet; the motion is the same.

const DA = window.DA || {};

const COLLECTIONS = [
  {
    name: "Les Fondateurs",
    tagline: "De l'abajoue à la logodiarrhée.",
    back: "night",
    ink: "img/collection-fondateurs.webp",
  },
  {
    name: "Caractères et travers",
    tagline: "Des mots pour railler les défauts de chacun.",
    back: "burgundy",
    ink: "img/collection-caracteres.webp",
  },
  {
    name: "Métiers et objets disparus",
    tagline: "Les métiers qu'on n'exerce plus, et leurs outils.",
    back: "green",
    ink: "img/collection-metiers.webp",
  },
];

const CARDS = [
  {
    id: "abajoue",
    word: "abajoue",
    pos: "n. f.",
    r: "common",
    freq: "8/Md",
    fresh: false,
    def: "Poche de chaque côté de la bouche de certains singes, chauves-souris et rongeurs, où ils gardent leur nourriture en réserve un moment.",
  },
  {
    id: "aliboron",
    word: "aliboron",
    pos: "n. m.",
    r: "uncommon",
    freq: "9/Md",
    fresh: true,
    def: "Surnom plaisant de l'âne, toujours précédé de « maître » ; par extension, homme ignorant et stupide, que l'on traite d'âne.",
  },
  {
    id: "ambesas",
    word: "ambesas",
    pos: "n. m.",
    r: "rare",
    freq: "1/Md",
    fresh: true,
    def: "Au trictrac, jet de dés qui amène deux as, c'est-à-dire un as sur chacun des deux dés.",
  },
  {
    id: "affolage",
    word: "affolage",
    pos: "n. m.",
    r: "epic",
    freq: "< 1/Md",
    fresh: true,
    def: "Maladie des anémones qui les fait pousser en feuilles sans jamais fleurir.",
  },
  {
    id: "antanagoge",
    word: "antanagoge",
    pos: "n. f.",
    r: "legendary",
    freq: "< 1/Md",
    fresh: true,
    def: "Figure de rhétorique par laquelle on riposte à une accusation en la retournant contre celui qui l'a portée ; récrimination.",
  },
];

const RARITY = {
  common: { label: "Commune", level: 0, colors: ["#fff6e0", "#e8dcc2"] },
  uncommon: { label: "Peu commune", level: 1, colors: ["#5ff0b8", "#1f9e7a", "#c8ffe9"] },
  rare: { label: "Rare", level: 2, colors: ["#ff8a5c", "#f0603c", "#ffd2b8"] },
  epic: { label: "Épique", level: 3, colors: ["#ffe08a", "#ffc23d", "#fff4cf", "#ff9d2e"] },
  legendary: {
    label: "Légendaire",
    level: 4,
    colors: ["#ff9ad5", "#ffd36e", "#a5ff9a", "#7fe6ff", "#b49cff", "#ffffff"],
  },
};

// A sober direction turns every burst, shake and flash down at once.
const INTENSITY = DA.intensity ?? 1;

const SPRING = "cubic-bezier(.34,1.56,.64,1)";
const BIG_SPRING = "cubic-bezier(.2,1.9,.4,1)";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const buzz = (pattern) => navigator.vibrate?.(pattern);

// Stops an element's animations; settle keeps it where they had brought it.
function stop(el) {
  for (const a of el.getAnimations()) a.cancel();
}

function settle(el) {
  for (const a of el.getAnimations()) {
    a.commitStyles?.();
    a.cancel();
  }
}

function play(el, keyframes, options) {
  return el.animate(keyframes, { fill: "forwards", ...options });
}

// ---------- Icons: filled, two tones and an outline, colored by custom properties ----------

function gearPath(cx, cy, outer, inner, teeth) {
  const points = [];
  for (let i = 0; i < teeth * 4; i++) {
    const angle = (i / (teeth * 4)) * Math.PI * 2 - Math.PI / 2;
    const radius = i % 4 < 2 ? outer : inner;
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)} ${(cy + radius * Math.sin(angle)).toFixed(2)}`,
    );
  }
  return `M${points.join("L")}Z`;
}

const OUTLINE =
  'stroke="var(--io,#1b1530)" stroke-width="var(--iow,2.6)" stroke-linejoin="round" stroke-linecap="round"';
const GLOSS = 'fill="#fff" fill-opacity=".28"';

const ICONS = {
  defi: `<g ${OUTLINE}><rect x="19" y="3" width="10" height="7" rx="2" fill="var(--f3)"/><rect x="35" y="9" width="6" height="6" rx="1.5" transform="rotate(45 38 12)" fill="var(--f3)"/><circle cx="24" cy="27" r="17" fill="var(--f1)"/><circle cx="24" cy="27" r="12" fill="var(--f2)"/><path d="M24 27V18M24 27l6 3" fill="none"/></g><circle cx="24" cy="27" r="2.6" fill="var(--io,#1b1530)"/><path d="M12 22a13 13 0 0 1 8-9" stroke="#fff" stroke-opacity=".7" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  amis: `<g ${OUTLINE}><circle cx="32" cy="15" r="7" fill="var(--f2)"/><path d="M20 37a12 11 0 0 1 24 0v3H20z" fill="var(--f2)"/><circle cx="19" cy="19" r="8.5" fill="var(--f1)"/><path d="M4 43a15 13 0 0 1 30 0v1H4z" fill="var(--f1)"/></g><ellipse cx="16.5" cy="16" rx="3" ry="2.2" ${GLOSS}/>`,
  coffre: `<g ${OUTLINE}><path d="M6 22v17a3 3 0 0 0 3 3h30a3 3 0 0 0 3-3V22z" fill="var(--f1)"/><path d="M6 22v-4A10 10 0 0 1 16 8h16a10 10 0 0 1 10 10v4z" fill="var(--f2)"/><path d="M12 9v33M36 9v33" fill="none" stroke="var(--f3)" stroke-width="4"/><rect x="6" y="20" width="36" height="5" fill="var(--f3)"/><rect x="19.5" y="18" width="9" height="12" rx="2.5" fill="var(--f3)"/></g><path d="M11 17a8 8 0 0 1 6-6" stroke="#fff" stroke-opacity=".6" stroke-width="2.6" fill="none" stroke-linecap="round"/><circle cx="24" cy="23.5" r="1.8" fill="var(--io,#1b1530)"/>`,
  reglages: `<g ${OUTLINE}><path d="${gearPath(24, 24, 20, 15.5, 8)}" fill="var(--f1)"/><circle cx="24" cy="24" r="7" fill="var(--f2)"/></g><path d="M12 17a14 14 0 0 1 7-6" stroke="#fff" stroke-opacity=".55" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  clan: `<g ${OUTLINE}><path d="M24 4l17 6v12c0 11-7 18-17 22C14 40 7 33 7 22V10z" fill="var(--f1)"/><path d="M24 10v28c7-3 11-8 11-16v-8z" fill="var(--f2)" stroke="none"/></g>`,
  discussion: `<g ${OUTLINE}><path d="M9 8h30a5 5 0 0 1 5 5v17a5 5 0 0 1-5 5H23l-9 8v-8H9a5 5 0 0 1-5-5V13a5 5 0 0 1 5-5z" fill="var(--f1)"/></g><circle cx="15" cy="21.5" r="2.8" fill="var(--io,#1b1530)"/><circle cx="24" cy="21.5" r="2.8" fill="var(--io,#1b1530)"/><circle cx="33" cy="21.5" r="2.8" fill="var(--io,#1b1530)"/>`,
  joutes: `<g ${OUTLINE}><g transform="rotate(45 24 24)"><rect x="21.5" y="2" width="5" height="29" rx="1.5" fill="var(--f2)"/><rect x="14" y="30" width="20" height="4.5" rx="2.2" fill="var(--f3)"/><rect x="22" y="34" width="4" height="10" rx="1.8" fill="var(--f1)"/></g><g transform="rotate(-45 24 24)"><rect x="21.5" y="2" width="5" height="29" rx="1.5" fill="var(--f2)"/><rect x="14" y="30" width="20" height="4.5" rx="2.2" fill="var(--f3)"/><rect x="22" y="34" width="4" height="10" rx="1.8" fill="var(--f1)"/></g></g>`,
  album: `<g ${OUTLINE}><path d="M24 12C18 7 10 7 4 9v31c6-2 14-2 20 3 6-5 14-5 20-3V9c-6-2-14-2-20 3z" fill="var(--f1)"/><path d="M8 12c5-1 11 0 15 3v23c-4-2-10-3-15-2zM40 12c-5-1-11 0-15 3v23c4-2 10-3 15-2z" fill="var(--f2)"/></g>`,
  defis: `<g ${OUTLINE}><path d="M14 6h20v8a10 10 0 0 1-20 0z" fill="var(--f1)"/><path d="M14 9H7v3a7 7 0 0 0 7 7M34 9h7v3a7 7 0 0 1-7 7" fill="none"/><rect x="21" y="23" width="6" height="9" fill="var(--f1)"/><rect x="13" y="32" width="22" height="9" rx="2.5" fill="var(--f2)"/></g><path d="M18 9v5a6 6 0 0 0 3 5" stroke="#fff" stroke-opacity=".6" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,
  sachet: `<g ${OUTLINE}><path d="M11 5h26l2 5v28l-2 5H11l-2-5V10z" fill="var(--f1)"/><circle cx="24" cy="24" r="8" fill="var(--f3)"/></g><path d="M11 12h26" stroke="var(--io,#1b1530)" stroke-width="2" stroke-dasharray="2.5 2.5"/><path d="M14 16v18" stroke="#fff" stroke-opacity=".5" stroke-width="2.6" stroke-linecap="round"/>`,
  echanges: `<g ${OUTLINE}><path d="M6 17h25v-7l11 9-11 9v-7H6z" fill="var(--f1)"/><path d="M42 31H17v-7L6 33l11 9v-7h25z" fill="var(--f2)"/></g>`,
  communaute: `<g ${OUTLINE}><path d="M10 5v39" fill="none" stroke-width="3.5"/><path d="M11 7h28l-6 9 6 9H11z" fill="var(--f1)"/></g><circle cx="10" cy="5" r="3" fill="var(--f3)" ${OUTLINE}/>`,
  mail: `<g ${OUTLINE}><rect x="4" y="10" width="40" height="29" rx="5" fill="var(--f2)"/><path d="M6 13l18 14 18-14" fill="none"/></g>`,
  lock: `<g ${OUTLINE}><path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke-width="5.5"/><path d="M15 21v-6a9 9 0 0 1 18 0v6" fill="none" stroke="var(--f2,#c9c3b8)" stroke-width="2"/><rect x="10" y="20" width="28" height="23" rx="5" fill="var(--f3,#f3c444)"/></g><circle cx="24" cy="30" r="3" fill="var(--io,#1b1530)"/><rect x="22.6" y="31" width="2.8" height="6" rx="1.2" fill="var(--io,#1b1530)"/>`,
  arrow: `<g ${OUTLINE}><path d="M30 8L14 24l16 16" fill="none" stroke-width="7"/><path d="M30 8L14 24l16 16" fill="none" stroke="var(--f1,#fff)" stroke-width="3"/></g>`,
};

function icon(name) {
  return `<svg class="ic" viewBox="0 0 48 48" aria-hidden="true">${ICONS[name]}</svg>`;
}

// ---------- Markup ----------

function cardFace(card) {
  return `<div class="face" data-r="${card.r}"><div class="paper">
    <span class="gem"></span>
    <div class="grav" style="--img:url(img/${card.id}.webp)"></div>
    <div class="word">${card.word}</div>
    <span class="pos">${card.pos}</span>
    <p class="def">${card.def}</p>
    <div class="foot"><span>Les Fondateurs</span><b>${card.freq}</b></div>
    <div class="holo"></div>
  </div></div>`;
}

function sideButton(key, label, badge = "") {
  return `<button class="sbtn press ${key}" data-key="${key}">
    <span class="disc">${icon(key)}${badge ? `<em class="badge">${badge}</em>` : ""}</span><span class="lbl">${label}</span></button>`;
}

function lockedButton(key, label, level, message) {
  return `<button class="sbtn press locked ${key}" data-lock="${message}">
    <span class="disc">${icon(key)}<span class="lockpin">${icon("lock")}</span></span>
    <span class="lvl">Niv. ${level}</span><span class="lbl">${label}</span></button>`;
}

function render() {
  const current = COLLECTIONS[0];
  document.body.insertAdjacentHTML(
    "afterbegin",
    `<nav class="switch">
      <a href="index.html">Les trois</a>
      <a href="bibliotheque.html" ${DA.id === "bibliotheque" ? "aria-current" : ""}>A2 · La Bibliothèque</a>
      <a href="taverne.html" ${DA.id === "taverne" ? "aria-current" : ""}>A · La Taverne</a>
      <a href="jouet.html" ${DA.id === "jouet" ? "aria-current" : ""}>B · Le Jouet</a>
      <a href="grimoire.html" ${DA.id === "grimoire" ? "aria-current" : ""}>C · Le Grimoire</a>
    </nav>
    <div class="phone" id="phone"><div class="world">
      <div class="bg">${DA.background || ""}</div>
      <div class="ui">
        <header class="top">
          <button class="avatar press" aria-label="Mon profil"><span class="portrait"><i style="--img:url(img/antanagoge.webp)"></i></span></button>
          <div class="level">
            <span class="medal"><b>7</b></span>
            <span class="xp"><span class="xpfill" style="--p:.62"></span><span class="xptext">62 / 100</span></span>
          </div>
          <button class="stock press"><span class="stockic">${icon("sachet")}</span><span class="num">6/6</span></button>
          <button class="mail press" aria-label="Courrier">${icon("mail")}<em class="badge">2</em></button>
        </header>
        <main class="play">
          <div class="collection">
            <button class="arrow prev press" aria-label="Collection précédente">${icon("arrow")}</button>
            <div class="ctitle"><small>Sachet</small><strong class="cname">${current.name}</strong>
              <span class="dots"><i class="on"></i><i></i><i></i></span></div>
            <button class="arrow next press" aria-label="Collection suivante">${icon("arrow")}</button>
          </div>
          <p class="tagline">${current.tagline}</p>
          <div class="side left">
            ${lockedButton("clan", "Clan", 10, "Le clan s'ouvre au niveau 10.")}
            ${lockedButton("discussion", "Discussion", 10, "La discussion s'ouvre au niveau 10.")}
            ${lockedButton("joutes", "Joutes", 15, "Les joutes s'ouvrent au niveau 15.")}
          </div>
          <div class="side right">
            ${sideButton("defi", "Défi du jour", "!")}
            ${sideButton("amis", "Amis")}
            ${sideButton("coffre", "Récompenses", "1")}
            ${sideButton("reglages", "Réglages")}
          </div>
          <div class="packzone">
            <div class="packmove">
              <div class="packaura"></div>
              ${DA.packBackdrop || ""}
              <button class="pack" data-back="${current.back}" aria-label="Ouvrir le sachet">
                <span class="pack-top"><span class="tear"></span></span>
                <span class="pack-body">
                  <span class="pack-brand">Leximon</span>
                  <span class="pack-emblem"><i style="--img:url(${current.ink})"></i></span>
                  <span class="pack-ribbon">${current.name}</span>
                  <span class="pack-count">5 cartes</span>
                  <img class="pack-seal" src="img/logo-mark.svg" alt="">
                  <span class="pack-shine"></span>
                </span>
              </button>
            </div>
            <div class="packshadow"></div>
          </div>
        </main>
        <div class="cta">
          <button class="open press"><span class="open-label">Ouvrir le sachet</span><span class="open-count">6</span></button>
          <p class="refill">Ton stock est plein.</p>
        </div>
        <nav class="tabs">
          <button class="tab press">${icon("album")}<span>Album</span></button>
          <button class="tab press">${icon("defis")}<span>Défis</span><em class="badge">1</em></button>
          <button class="tab playtab"><span class="playdisc">${icon("sachet")}</span><span>Jouer</span></button>
          <button class="tab press locked" data-lock="Les échanges s'ouvrent au niveau 8.">${icon("echanges")}<span>Échanges</span><span class="tablock">${icon("lock")}</span></button>
          <button class="tab press">${icon("communaute")}<span>Communauté</span></button>
        </nav>
      </div>
      <div class="dim"></div>
      <section class="opening">
        <div class="spot"></div>
        <div class="ring"></div>
        <div class="hand"></div>
        <div class="zoomdim"></div>
        <div class="banner"><span></span></div>
        <p class="hint">Touche une carte pour la retourner.</p>
        <button class="revealall press">Tout retourner</button>
        <div class="after">
          <button class="open again press"><span class="open-label">Ouvrir un autre sachet</span><span class="open-count">5</span></button>
          <button class="ghost press">Voir mes cartes</button>
        </div>
        <div class="flash"></div>
      </section>
      <div class="toast"></div>
    </div>
    <canvas class="fx"></canvas></div>`,
  );
}

// ---------- Particles ----------

class Particles {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.list = [];
    this.last = performance.now();
    this.emitters = [];
    this.resize();
    window.addEventListener("resize", () => this.resize());
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = this.w * ratio;
    this.canvas.height = this.h * ratio;
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  add(p) {
    this.list.push({
      t: 0,
      vx: 0,
      vy: 0,
      g: 0,
      drag: 0.985,
      rot: rand(0, 6.28),
      vr: rand(-8, 8),
      flip: rand(0, 6.28),
      vf: rand(6, 14),
      grow: 0,
      wobble: 0,
      ...p,
    });
  }

  burst(x, y, o) {
    const count = Math.round(o.n * INTENSITY);
    for (let i = 0; i < count; i++) {
      const angle = rand(o.angle?.[0] ?? 0, o.angle?.[1] ?? Math.PI * 2);
      const speed = rand(o.speed[0], o.speed[1]);
      this.add({
        k: Array.isArray(o.k) ? pick(o.k) : o.k,
        x: x + rand(-(o.spread ?? 0), o.spread ?? 0),
        y: y + rand(-(o.spread ?? 0), o.spread ?? 0),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        g: o.g ?? 0,
        drag: o.drag ?? 0.97,
        life: rand(o.life[0], o.life[1]),
        size: rand(o.size[0], o.size[1]),
        color: pick(o.colors),
        grow: o.grow ?? 0,
        wobble: o.wobble ?? 0,
        letter: o.letters ? pick([...o.letters]) : undefined,
      });
    }
  }

  // Particles that converge on a point, as if the card drew its light in.
  implode(x, y, o) {
    for (let i = 0; i < o.n; i++) {
      const angle = rand(0, Math.PI * 2);
      const distance = rand(o.radius[0], o.radius[1]);
      const life = rand(0.35, 0.6);
      this.add({
        k: o.k,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance,
        vx: (-Math.cos(angle) * distance) / life,
        vy: (-Math.sin(angle) * distance) / life,
        drag: 1,
        life,
        size: rand(o.size[0], o.size[1]),
        color: pick(o.colors),
      });
    }
  }

  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.05);
    this.last = now;
    for (const emitter of this.emitters) emitter(dt, this);
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    const alive = [];
    for (const p of this.list) {
      p.t += dt;
      if (p.t >= p.life) continue;
      const k = 60 * dt;
      p.vx *= p.drag ** k;
      p.vy *= p.drag ** k;
      p.vy += p.g * dt;
      p.x += p.vx * dt + (p.wobble ? Math.sin(p.t * 3 + p.rot) * p.wobble * dt : 0);
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      p.flip += p.vf * dt;
      alive.push(p);
      this.draw(ctx, p);
    }
    this.list = alive;
    requestAnimationFrame((t) => this.frame(t));
  }

  draw(ctx, p) {
    const age = p.t / p.life;
    const fade = 1 - age * age;
    const size = p.size * (1 + p.grow * age);
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.k === "glow" || p.k === "ember") {
      ctx.globalCompositeOperation = "lighter";
      const r = size * (p.k === "ember" ? 2.2 : 3);
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      gradient.addColorStop(0, p.color);
      gradient.addColorStop(0.25, p.color);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = p.k === "ember" ? Math.sin(age * Math.PI) : fade;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.k === "spark") {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = fade;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = size;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-p.vx * 0.045, -p.vy * 0.045);
      ctx.stroke();
    } else if (p.k === "star") {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = fade;
      ctx.rotate(p.rot * 0.3);
      const s = size * (0.75 + 0.25 * Math.sin(p.flip));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const r = i % 2 ? s * 0.28 : s;
        const a = (i / 8) * Math.PI * 2;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    } else if (p.k === "confetti") {
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.flip));
      ctx.fillStyle = p.color;
      ctx.fillRect(-size / 2, -size * 0.3, size, size * 0.6);
    } else if (p.k === "leaf") {
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      ctx.rotate(p.rot);
      ctx.scale(Math.cos(p.flip), 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(-size, 0);
      ctx.quadraticCurveTo(0, -size * 0.7, size, 0);
      ctx.quadraticCurveTo(0, size * 0.7, -size, 0);
      ctx.fill();
    } else if (p.k === "coin") {
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      ctx.scale(Math.cos(p.flip), 1);
      ctx.fillStyle = "#ffcf3a";
      ctx.strokeStyle = "#7a4a00";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#fff3b0";
      ctx.beginPath();
      ctx.arc(-size * 0.3, -size * 0.3, size * 0.3, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.k === "smoke") {
      ctx.globalAlpha = fade * 0.35;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.k === "letter") {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.sin(age * Math.PI);
      ctx.rotate(p.rot * 0.15);
      ctx.fillStyle = p.color;
      ctx.font = `700 ${size}px Cinzel, serif`;
      ctx.textAlign = "center";
      ctx.fillText(p.letter || "A", 0, 0);
    }
    ctx.restore();
  }
}

// ---------- Screen ----------

render();

const phone = $("#phone");
const world = $(".world", phone);
const fx = new Particles($(".fx"));
const packEl = $(".pack");
const packMove = $(".packmove");
const hand = $(".hand");
const toastEl = $(".toast");
let collectionIndex = 0;
let busy = false;
let revealed = 0;
let zoomed = null;

function fitPhone() {
  if (window.innerWidth <= 520) {
    phone.style.transform = "";
    return;
  }
  const scale = Math.min(1, (window.innerHeight - 40) / 844, (window.innerWidth - 40) / 390);
  phone.style.transform = `scale(${scale})`;
}
fitPhone();
window.addEventListener("resize", fitPhone);

function phoneScale() {
  return phone.getBoundingClientRect().width / phone.offsetWidth;
}

// Center of an element in the phone's own coordinates.
function centerOf(el) {
  const box = el.getBoundingClientRect();
  const frame = phone.getBoundingClientRect();
  const s = phoneScale();
  return {
    x: (box.left + box.width / 2 - frame.left) / s,
    y: (box.top + box.height / 2 - frame.top) / s,
  };
}

function shake(strength = 8, duration = 420) {
  const frames = [];
  for (let i = 0; i <= 10; i++) {
    const k = strength * INTENSITY * (1 - i / 10);
    frames.push({
      transform: `translate(${rand(-k, k)}px, ${rand(-k, k)}px) rotate(${rand(-k, k) * 0.12}deg)`,
    });
  }
  frames.push({ transform: "none" });
  world.animate(frames, { duration, easing: "linear" });
}

function flash(opacity = 0.9, duration = 380) {
  $(".flash").animate([{ opacity: opacity * INTENSITY }, { opacity: 0 }], {
    duration,
    easing: "ease-out",
  });
}

function shockwave(x, y, color, size = 5) {
  const ring = $(".ring");
  ring.style.left = `${x}px`;
  ring.style.top = `${y}px`;
  ring.style.setProperty("--ring", color);
  ring.animate(
    [
      { transform: "scale(.2)", opacity: 1 },
      { transform: `scale(${size})`, opacity: 0 },
    ],
    { duration: 650, easing: "cubic-bezier(.1,.7,.3,1)" },
  );
}

function toast(text) {
  toastEl.textContent = text;
  stop(toastEl);
  toastEl.animate(
    [
      { opacity: 0, scale: 0.6 },
      { opacity: 1, scale: 1.08, offset: 0.08 },
      { opacity: 1, scale: 1, offset: 0.14 },
      { opacity: 1, scale: 1, offset: 0.85 },
      { opacity: 0, scale: 0.9 },
    ],
    { duration: 2200, easing: "ease-out" },
  );
}

// Every pressable thing sinks under the finger and springs back when released.
function pop(el) {
  el.animate([{ scale: "0.9" }, { scale: "1.07" }, { scale: "0.98" }, { scale: "1" }], {
    duration: 420,
    easing: "ease-out",
  });
}

document.addEventListener("pointerdown", (event) => {
  const el = event.target.closest(".press");
  if (!el) return;
  el.classList.add("down");
  buzz(6);
  const release = () => {
    el.classList.remove("down");
    pop(el);
    window.removeEventListener("pointerup", release);
    window.removeEventListener("pointercancel", release);
  };
  window.addEventListener("pointerup", release);
  window.addEventListener("pointercancel", release);
});

// ---------- Idle life ----------

if (DA.ambient) fx.emitters.push(DA.ambient);

for (const el of $$(".locked")) {
  el.addEventListener("click", () => {
    el.animate(
      [
        { translate: "0" },
        { translate: "-6px" },
        { translate: "6px" },
        { translate: "-4px" },
        { translate: "3px" },
        { translate: "0" },
      ],
      { duration: 380 },
    );
    toast(el.dataset.lock);
  });
}

$(".sbtn.coffre").addEventListener("click", (event) => {
  const c = centerOf(event.currentTarget);
  fx.burst(c.x, c.y, {
    n: 18,
    k: DA.smallBurst?.k ?? "star",
    colors: DA.smallBurst?.colors ?? ["#ffd36e", "#fff"],
    speed: [80, 220],
    life: [0.4, 0.8],
    size: [3, 7],
    g: 300,
  });
});

$(".sbtn.defi").addEventListener("click", () =>
  toast("Le défi du jour t'attend : cinq mots à retrouver."),
);
$(".sbtn.amis").addEventListener("click", () => toast("Tu as 3 amis."));
$(".sbtn.reglages").addEventListener("click", () => toast("Les réglages."));

function setCollection(index, direction) {
  if (busy) return;
  collectionIndex = (index + COLLECTIONS.length) % COLLECTIONS.length;
  const next = COLLECTIONS[collectionIndex];
  const out = direction > 0 ? -1 : 1;
  const anim = packMove.animate(
    [
      { transform: "none", opacity: 1 },
      { transform: `translateX(${out * 260}px) rotate(${out * -16}deg) scale(.8)`, opacity: 0 },
    ],
    { duration: 200, easing: "ease-in", fill: "forwards" },
  );
  anim.finished.then(() => {
    packEl.dataset.back = next.back;
    $(".pack-emblem i").style.setProperty("--img", `url(${next.ink})`);
    $(".pack-ribbon").textContent = next.name;
    $(".cname").textContent = next.name;
    $(".tagline").textContent = next.tagline;
    for (const [i, dot] of $$(".dots i").entries())
      dot.classList.toggle("on", i === collectionIndex);
    packMove.animate(
      [
        { transform: `translateX(${-out * 260}px) rotate(${out * 16}deg) scale(.8)`, opacity: 0 },
        { transform: "none", opacity: 1 },
      ],
      { duration: 520, easing: SPRING, fill: "forwards" },
    );
    $(".cname").animate([{ scale: "0.7" }, { scale: "1.1" }, { scale: "1" }], {
      duration: 400,
      easing: "ease-out",
    });
  });
}

$(".arrow.prev").addEventListener("click", () => setCollection(collectionIndex - 1, -1));
$(".arrow.next").addEventListener("click", () => setCollection(collectionIndex + 1, 1));

// ---------- Opening a pack ----------

function slotLayout() {
  const W = phone.offsetWidth;
  const H = phone.offsetHeight;
  const s = Math.min(0.44, (W - 40) / 3 / 260);
  const cw = 260 * s;
  const ch = 364 * s;
  const gap = 10;
  const top = H * 0.17 + ch / 2;
  const bottom = top + ch + 18;
  // The rarest card always falls in the middle of the top row, where the eye goes first.
  return [
    { x: W / 2 - cw - gap, y: top + 8, r: -5, s },
    { x: W / 2 - cw / 2 - gap / 2, y: bottom, r: -2, s },
    { x: W / 2 + cw + gap, y: top + 8, r: 5, s },
    { x: W / 2 + cw / 2 + gap / 2, y: bottom, r: 2, s },
    { x: W / 2, y: top, r: 0, s },
  ];
}

function slotTransform(p) {
  return `translate(${p.x - 130}px, ${p.y - 182}px) rotate(${p.r}deg) scale(${p.s})`;
}

function buildHand() {
  hand.innerHTML = "";
  const layout = slotLayout();
  CARDS.forEach((card, i) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.r = card.r;
    if (RARITY[card.r].level >= 2) slot.dataset.hint = "";
    slot.innerHTML = `<div class="aura"></div><div class="srays"></div>
      <div class="card3d"><div class="back"><div class="cloth"><img src="img/logo-mark.svg" alt=""></div></div>${cardFace(card)}</div>
      ${card.fresh ? '<span class="sticker">Nouveau</span>' : ""}`;
    slot.card = card;
    slot.place = layout[i];
    slot.style.transform = slotTransform(layout[i]);
    slot.addEventListener("click", () => onSlot(slot));
    hand.append(slot);
  });
}

async function openPack() {
  if (busy) return;
  busy = true;
  revealed = 0;
  buzz(15);
  phone.classList.add("is-opening");
  buildHand();

  // The pack comes to the middle and grows.
  const from = centerOf(packMove);
  const W = phone.offsetWidth;
  const H = phone.offsetHeight;
  const dx = W / 2 - from.x;
  const dy = H * 0.45 - from.y;
  await play(
    packMove,
    [{ transform: "none" }, { transform: `translate(${dx}px, ${dy}px) scale(1.3)` }],
    {
      duration: 520,
      easing: SPRING,
    },
  ).finished;

  // It shakes harder and harder while light leaks from the seam.
  packEl.classList.add("charging");
  const aura = $(".packaura");
  play(
    aura,
    [
      { transform: "scale(.9)", opacity: 0.5 },
      { transform: "scale(1.9)", opacity: 1 },
    ],
    {
      duration: 1100,
      easing: "ease-in",
    },
  );
  const frames = [];
  for (let i = 0; i <= 26; i++) {
    const k = 0.4 + (i / 26) ** 1.6 * 7;
    frames.push({
      transform: `translate(${rand(-k, k)}px, ${rand(-k, k) * 0.5}px) rotate(${rand(-k, k) * 0.5}deg)`,
    });
  }
  const seam = () => {
    const c = centerOf($(".pack-top"));
    return { x: c.x, y: c.y + 14 };
  };
  let charge = 0;
  const sparkTimer = setInterval(() => {
    charge++;
    const s = seam();
    fx.burst(s.x, s.y, {
      n: 1 + Math.floor(charge / 4),
      k: DA.charge?.k ?? "spark",
      colors: DA.charge?.colors ?? ["#fff2c0", "#ffd36e"],
      speed: [120, 320],
      angle: [-Math.PI * 0.95, -Math.PI * 0.05],
      spread: 50,
      life: [0.25, 0.5],
      size: [1.5, 3],
      g: 400,
    });
    if (charge % 5 === 0) buzz(8 + charge);
  }, 55);
  await packEl.animate(frames, { duration: 1150, easing: "linear" }).finished;
  clearInterval(sparkTimer);

  // It bursts.
  const c = centerOf(packEl);
  flash(1, 500);
  shake(10, 450);
  buzz([30, 20, 60]);
  shockwave(c.x, c.y, DA.burst?.ring ?? "#fff2c0", 6);
  fx.burst(c.x, c.y, {
    n: 90,
    k: DA.burst?.k ?? ["spark", "glow"],
    colors: DA.burst?.colors ?? ["#fff", "#ffd36e"],
    speed: [200, 900],
    life: [0.4, 1.1],
    size: [2, 5],
    g: 500,
    drag: 0.94,
  });
  if (DA.burst?.extra) fx.burst(c.x, c.y, DA.burst.extra);
  packEl.classList.remove("charging");
  play(
    $(".pack-top"),
    [{ transform: "none" }, { transform: "translate(70px, -300px) rotate(50deg)", opacity: 0 }],
    {
      duration: 650,
      easing: "cubic-bezier(.2,.6,.4,1)",
    },
  );
  play(
    $(".pack-body"),
    [{ transform: "none" }, { transform: "translate(-10px, 420px) rotate(-14deg)", opacity: 0 }],
    {
      duration: 620,
      easing: "cubic-bezier(.5,0,.9,.6)",
    },
  );
  play(aura, [{ opacity: 1 }, { opacity: 0 }], { duration: 400 });

  // The cards fly out to their places.
  const slots = $$(".slot", hand);
  slots.forEach((slot, i) => {
    const p = slot.place;
    const start = `translate(${c.x - 130}px, ${c.y - 182}px) rotate(${rand(-40, 40)}deg) scale(.15)`;
    slot.animate(
      [
        { transform: start, opacity: 0 },
        { opacity: 1, offset: 0.2 },
        { transform: slotTransform(p), opacity: 1 },
      ],
      { duration: 640, delay: 90 + i * 80, easing: BIG_SPRING, fill: "forwards" },
    );
    setTimeout(
      () => {
        const land = centerOf(slot);
        fx.burst(land.x, land.y + 70, {
          n: 6,
          k: "smoke",
          colors: [DA.dust ?? "rgba(255,255,255,.6)"],
          speed: [20, 70],
          angle: [Math.PI * 0.9, Math.PI * 2.1],
          life: [0.4, 0.7],
          size: [6, 12],
          grow: 1.5,
        });
        buzz(5);
      },
      90 + i * 80 + 380,
    );
  });
  await wait(90 + slots.length * 80 + 640);
  $(".hint").classList.add("on");
  $(".revealall").classList.add("on");
  busy = false;
}

async function flip(slot) {
  if (slot.flipped || slot.flipping) return;
  slot.flipping = true;
  $(".hint").classList.remove("on");
  const card = slot.card;
  const level = RARITY[card.r].level;
  const colors = RARITY[card.r].colors;
  const card3d = $(".card3d", slot);
  const c = centerOf(slot);

  // The rarest cards make you wait: they tremble and draw the light in before turning.
  if (level >= 3) {
    const frames = [];
    const steps = level === 4 ? 22 : 14;
    for (let i = 0; i <= steps; i++) {
      const k = 1 + (i / steps) * (level === 4 ? 5 : 3);
      frames.push({
        transform: `translate(${rand(-k, k)}px, ${rand(-k, k)}px) rotate(${rand(-k, k) * 0.6}deg)`,
      });
    }
    frames.push({ transform: "none" });
    const pull = setInterval(
      () => fx.implode(c.x, c.y, { n: 3, k: "glow", colors, radius: [90, 170], size: [2, 4] }),
      60,
    );
    buzz(level === 4 ? [10, 40, 10, 40, 10, 40, 20] : [10, 40, 10, 40]);
    await card3d.animate(frames, { duration: level === 4 ? 1000 : 650, easing: "linear" }).finished;
    clearInterval(pull);
  }

  slot.removeAttribute("data-hint");
  slot.animate([{ scale: "1" }, { scale: "1.22" }, { scale: "1" }], {
    duration: 560,
    easing: "ease-out",
  });
  card3d.animate([{ transform: "rotateY(0)" }, { transform: "rotateY(180deg)" }], {
    duration: 560,
    easing: "cubic-bezier(.3,1.5,.5,1)",
    fill: "forwards",
  });
  await wait(220);
  rarityBurst(slot, c, level, colors);
  slot.flipped = true;
  slot.flipping = false;
  revealed++;
  const sticker = $(".sticker", slot);
  if (sticker) {
    setTimeout(
      () =>
        sticker.animate(
          [
            { transform: "rotate(10deg) scale(0)" },
            { transform: "rotate(-8deg) scale(1.3)" },
            { transform: "rotate(10deg) scale(1)" },
          ],
          { duration: 450, easing: SPRING, fill: "forwards" },
        ),
      300,
    );
  }
  if (level === 4) {
    await wait(500);
    zoom(slot);
  }
  if (revealed === CARDS.length) finish();
}

function rarityBurst(slot, c, level, colors) {
  const glowColor = getComputedStyle(slot).getPropertyValue("--glow");
  if (level === 0) {
    fx.burst(c.x, c.y, {
      n: 10,
      k: "smoke",
      colors: [DA.dust ?? "rgba(255,255,255,.6)"],
      speed: [40, 120],
      life: [0.4, 0.7],
      size: [8, 14],
      grow: 1.2,
    });
    buzz(8);
    return;
  }
  if (level === 1) {
    fx.burst(c.x, c.y, {
      n: 26,
      k: "star",
      colors,
      speed: [60, 260],
      life: [0.4, 0.9],
      size: [3, 6],
      g: 120,
    });
    buzz(12);
    return;
  }
  if (level === 2) {
    shockwave(c.x, c.y, glowColor, 3.5);
    fx.burst(c.x, c.y, {
      n: 50,
      k: ["spark", "star"],
      colors,
      speed: [150, 520],
      life: [0.4, 0.9],
      size: [2, 5],
      g: 300,
    });
    shake(4, 260);
    buzz([20, 30, 20]);
    return;
  }
  const rays = $(".srays", slot);
  rays.animate(
    [
      { opacity: 0, scale: "0.3" },
      { opacity: 1, scale: "1" },
    ],
    { duration: 500, easing: SPRING, fill: "forwards" },
  );
  shockwave(c.x, c.y, glowColor, level === 4 ? 9 : 6);
  flash(level === 4 ? 0.95 : 0.5, level === 4 ? 650 : 400);
  shake(level === 4 ? 14 : 8, level === 4 ? 650 : 420);
  fx.burst(c.x, c.y, {
    n: level === 4 ? 130 : 80,
    k: ["spark", "glow", "star"],
    colors,
    speed: [200, 900],
    life: [0.5, 1.3],
    size: [2, 6],
    g: 350,
    drag: 0.95,
  });
  const rain = DA.rain ?? { k: "confetti" };
  fx.burst(phone.offsetWidth / 2, -20, {
    n: level === 4 ? 140 : 60,
    k: rain.k,
    colors: rain.colors ?? colors,
    speed: [50, 300],
    angle: [Math.PI * 0.15, Math.PI * 0.85],
    spread: phone.offsetWidth / 2,
    life: [1.6, 3],
    size: [5, 10],
    g: 260,
    drag: 0.985,
    wobble: 40,
  });
  buzz(level === 4 ? [40, 30, 80, 30, 120] : [30, 30, 60]);
  banner(RARITY[slot.card.r].label, slot.card.r);
}

function banner(text, rarity) {
  const el = $(".banner span");
  el.textContent = text;
  el.dataset.r = rarity;
  stop(el);
  el.animate(
    [
      { opacity: 0, transform: "scale(2.4) rotate(-6deg)" },
      { opacity: 1, transform: "scale(.92) rotate(2deg)", offset: 0.12 },
      { opacity: 1, transform: "scale(1.04) rotate(-1deg)", offset: 0.2 },
      { opacity: 1, transform: "scale(1) rotate(0)", offset: 0.8 },
      { opacity: 0, transform: "scale(1.1) translateY(-20px)" },
    ],
    { duration: 2200, easing: "ease-out", fill: "forwards" },
  );
}

function zoom(slot) {
  const W = phone.offsetWidth;
  const H = phone.offsetHeight;
  const s = Math.min(1.25, (W - 48) / 260);
  zoomed = slot;
  slot.classList.add("zoomed");
  $(".zoomdim").classList.add("on");
  settle(slot);
  slot.style.opacity = "1";
  slot.animate(
    [
      { transform: slotTransform(slot.place) },
      { transform: slotTransform({ x: W / 2, y: H * 0.46, r: 0, s }) },
    ],
    {
      duration: 560,
      easing: SPRING,
      fill: "forwards",
    },
  );
  buzz(10);
}

function unzoom() {
  const slot = zoomed;
  if (!slot) return;
  zoomed = null;
  $(".zoomdim").classList.remove("on");
  settle(slot);
  slot
    .animate([{ transform: slot.style.transform }, { transform: slotTransform(slot.place) }], {
      duration: 460,
      easing: SPRING,
      fill: "forwards",
    })
    .finished.then(() => slot.classList.remove("zoomed"));
}

function onSlot(slot) {
  if (zoomed) return unzoom();
  if (!slot.flipped) return flip(slot);
  zoom(slot);
}

$(".zoomdim").addEventListener("click", unzoom);

async function revealAll() {
  $(".revealall").classList.remove("on");
  const order = $$(".slot", hand).sort((a, b) => RARITY[a.card.r].level - RARITY[b.card.r].level);
  for (const slot of order) {
    if (slot.flipped) continue;
    if (zoomed) {
      unzoom();
      await wait(400);
    }
    await flip(slot);
    await wait(RARITY[slot.card.r].level >= 3 ? 700 : 260);
  }
}

$(".revealall").addEventListener("click", revealAll);

function finish() {
  $(".revealall").classList.remove("on");
  const after = $(".after");
  setTimeout(() => {
    after.classList.add("on");
    for (const [i, el] of [...after.children].entries()) {
      el.animate(
        [
          { opacity: 0, transform: "translateY(60px) scale(.8)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 600, delay: i * 90, easing: SPRING, fill: "forwards" },
      );
    }
  }, 900);
}

async function closeOpening() {
  if (busy) return;
  busy = true;
  if (zoomed) unzoom();
  const after = $(".after");
  after.classList.remove("on");
  for (const el of after.children) {
    el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
  }
  $(".revealall").classList.remove("on");
  $(".hint").classList.remove("on");
  $$(".slot", hand).forEach((slot, i) => {
    settle(slot);
    slot.animate(
      [
        { transform: slot.style.transform, opacity: 1 },
        {
          transform: `${slot.style.transform} translateY(900px) rotate(${rand(-30, 30)}deg)`,
          opacity: 1,
        },
      ],
      {
        duration: 420,
        delay: i * 40,
        easing: "cubic-bezier(.5,0,.9,.5)",
        fill: "forwards",
      },
    );
  });
  await wait(500);
  hand.innerHTML = "";
  for (const el of [packMove, $(".pack-top"), $(".pack-body"), $(".packaura"), packEl]) {
    stop(el);
  }
  phone.classList.remove("is-opening");
  packMove.animate(
    [
      { transform: "scale(0) rotate(-20deg)", opacity: 0 },
      { transform: "scale(1) rotate(0)", opacity: 1 },
    ],
    { duration: 700, delay: 250, easing: BIG_SPRING, fill: "backwards" },
  );
  setTimeout(() => {
    const c = centerOf(packMove);
    fx.burst(c.x, c.y, {
      n: 24,
      k: DA.smallBurst?.k ?? "star",
      colors: DA.smallBurst?.colors ?? ["#fff", "#ffd36e"],
      speed: [100, 300],
      life: [0.4, 0.8],
      size: [3, 6],
    });
  }, 450);
  await wait(800);
  busy = false;
}

packEl.addEventListener("click", openPack);
$(".cta .open").addEventListener("click", openPack);
$(".after .again").addEventListener("click", async () => {
  await closeOpening();
  openPack();
});
$(".after .ghost").addEventListener("click", closeOpening);
