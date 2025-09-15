// ui.js
// Создание HUD: HP игрока и счёт (лево-верх), прицел (центр), нижняя панель

export function createUI() {
  const root = document.getElementById("hud-root");
  root.innerHTML = "";

  // Оверлей выбора героя
  const heroSelect = document.createElement("div");
  Object.assign(heroSelect.style, {
    position: "absolute",
    inset: "0",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.6)",
    pointerEvents: "auto",
  });
  root.appendChild(heroSelect);

  const heroGrid = document.createElement("div");
  Object.assign(heroGrid.style, {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
    gap: "12px",
    width: "min(900px, 90vw)",
  });
  heroSelect.appendChild(heroGrid);

  const heroTitle = document.createElement("div");
  heroTitle.textContent = "Выберите героя";
  Object.assign(heroTitle.style, { marginBottom: "12px", fontSize: "18px", fontWeight: "700", textAlign: "center" });
  heroSelect.insertBefore(heroTitle, heroGrid);

  // Левый верхний угол
  const topLeft = document.createElement("div");
  topLeft.id = "top-left";
  topLeft.innerHTML = `
    <div>HP: <span id="ui-hp" class="value">100</span></div>
    <div>Bases: <span id="ui-base-r" class="value">1000</span> vs <span id="ui-base-d" class="value">1000</span></div>
    <div>Gold: <span id="ui-gold" class="value">0</span> | Lv <span id="ui-level" class="value">1</span> (<span id="ui-xp">0</span>/<span id="ui-xpnext">100</span>)</div>
    <div>Tip: ПКМ по земле — двигаться; ПКМ по врагу — атаковать. QWER — скиллы.</div>
  `;
  root.appendChild(topLeft);

  // Портрет и имя героя — левый верх (над остальным)
  const heroCard = document.createElement("div");
  Object.assign(heroCard.style, {
    position: "absolute",
    top: "12px",
    right: "12px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "8px 10px",
    pointerEvents: "none",
  });
  heroCard.innerHTML = `
    <img id="ui-portrait" src="" alt="portrait" style="width:44px;height:44px;border-radius:6px;object-fit:cover;filter:saturate(1.05);"/>
    <div>
      <div id="ui-hero-name" style="font-weight:700">Hero</div>
      <div id="ui-hero-role" style="opacity:0.8;font-size:12px;">Role</div>
    </div>
  `;
  root.appendChild(heroCard);

  // Центровой прицел
  const crosshair = document.createElement("div");
  crosshair.id = "crosshair";
  root.appendChild(crosshair);

  // Нижняя панель
  const bottomBar = document.createElement("div");
  bottomBar.id = "bottom-bar";
  bottomBar.innerHTML = `
    <span id="ui-abilities">
      <button id="ab-Q-btn" style="pointer-events:auto">Q: <span id="ab-Q-name">—</span> <span id="ab-Q-cd"></span></button>
      <button id="ab-W-btn" style="pointer-events:auto">W: <span id="ab-W-name">—</span> <span id="ab-W-cd"></span></button>
      <button id="ab-E-btn" style="pointer-events:auto">E: <span id="ab-E-name">—</span> <span id="ab-E-cd"></span></button>
      <button id="ab-R-btn" style="pointer-events:auto">R: <span id="ab-R-name">—</span> <span id="ab-R-cd"></span></button>
    </span>
    <div id="ui-ability-desc" style="opacity:0.9;margin-top:4px;font-size:12px;">—</div>
  `;
  root.appendChild(bottomBar);

  // Возвращаем API для обновления HUD
  const hpEl = topLeft.querySelector("#ui-hp");
  // Мана — добавим отдельную строку ниже HP
  const manaRow = document.createElement('div');
  manaRow.innerHTML = 'Mana: <span id="ui-mana" class="value">300</span>/<span id="ui-mana-max" class="value">300</span>';
  topLeft.appendChild(manaRow);
  const manaEl = manaRow.querySelector('#ui-mana');
  const manaMaxEl = manaRow.querySelector('#ui-mana-max');
  const baseREl = topLeft.querySelector("#ui-base-r");
  const baseDEl = topLeft.querySelector("#ui-base-d");
  const goldEl = topLeft.querySelector("#ui-gold");
  const levelEl = topLeft.querySelector("#ui-level");
  const xpEl = topLeft.querySelector("#ui-xp");
  const xpNextEl = topLeft.querySelector("#ui-xpnext");
  const portraitEl = heroCard.querySelector("#ui-portrait");
  const heroNameEl = heroCard.querySelector("#ui-hero-name");
  const heroRoleEl = heroCard.querySelector("#ui-hero-role");

  // Сообщения по центру сверху
  const announce = document.createElement("div");
  Object.assign(announce.style, {
    position: "absolute",
    top: "50px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "14px",
    pointerEvents: "none",
    display: "none",
  });
  root.appendChild(announce);

  return {
    setHP(value) {
      hpEl.textContent = String(Math.max(0, Math.floor(value)));
    },
    setBases(r, d) {
      baseREl.textContent = String(Math.max(0, Math.floor(r)));
      baseDEl.textContent = String(Math.max(0, Math.floor(d)));
    },
    setMana(v, max) {
      manaEl.textContent = String(Math.max(0, Math.floor(v)));
      manaMaxEl.textContent = String(Math.max(0, Math.floor(max)));
    },
    setGold(v) {
      goldEl.textContent = String(Math.max(0, Math.floor(v)));
    },
    setLevelXP(level, xp, xpNext) {
      levelEl.textContent = String(level);
      xpEl.textContent = String(Math.max(0, Math.floor(xp)));
      xpNextEl.textContent = String(Math.max(1, Math.floor(xpNext)));
    },
    announce(msg, ms = 2000) {
      announce.textContent = msg;
      announce.style.display = "block";
      clearTimeout(announce._t);
      announce._t = setTimeout(() => { announce.style.display = "none"; }, ms);
    },
    setHeroCard({ name, role, portrait }) {
      if (portrait) portraitEl.src = portrait;
      if (name) heroNameEl.textContent = name;
      if (role) heroRoleEl.textContent = role;
    },
    setAbilities(abilities) {
      const names = { Q: document.getElementById("ab-Q-name"), W: document.getElementById("ab-W-name"), E: document.getElementById("ab-E-name"), R: document.getElementById("ab-R-name") };
      const cds = { Q: document.getElementById("ab-Q-cd"), W: document.getElementById("ab-W-cd"), E: document.getElementById("ab-E-cd"), R: document.getElementById("ab-R-cd") };
      for (const key of Object.keys(names)) {
        const a = abilities[key];
        if (!a) continue;
        names[key].textContent = a.name;
        cds[key].textContent = a.cooldown ? `(CD ${a.cooldown}s)` : "";
      }
      const descEl = document.getElementById("ui-ability-desc");
      descEl.textContent = Object.entries(abilities).map(([k,a]) => `${k}: ${a.name} — ${a.desc || ''}`).join(' | ');
    },
    updateAbilityCooldowns(remainsByKey) {
      const cds = { Q: document.getElementById("ab-Q-cd"), W: document.getElementById("ab-W-cd"), E: document.getElementById("ab-E-cd"), R: document.getElementById("ab-R-cd") };
      for (const k of Object.keys(cds)) {
        const v = remainsByKey[k];
        if (v && v > 0) cds[k].textContent = `(CD ${v.toFixed(1)}s)`; else cds[k].textContent = "";
      }
    },
    showHeroSelect(heroes, onSelect) {
      heroGrid.innerHTML = "";
      heroes.forEach((h) => {
        const card = document.createElement("button");
        Object.assign(card.style, {
          display: "flex", flexDirection: "column", gap: "6px",
          background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: "10px", padding: "10px", textAlign: "left", cursor: "pointer",
          color: "#e6edf3"
        });
        card.innerHTML = `
          <img src="${h.portrait || ''}" style="width:100%;height:140px;object-fit:cover;border-radius:8px"/>
          <div style="font-weight:700">${h.name}</div>
          <div style="opacity:0.8;font-size:12px;">${h.role || ''}</div>
        `;
        card.addEventListener('click', () => { onSelect?.(h.key); this.hideHeroSelect(); });
        heroGrid.appendChild(card);
      });
      heroSelect.style.display = "flex";
    },
    hideHeroSelect() {
      heroSelect.style.display = "none";
    }
  };
}

