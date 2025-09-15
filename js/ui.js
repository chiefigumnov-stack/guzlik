// ui.js
// Создание HUD: HP игрока и счёт (лево-верх), прицел (центр), нижняя панель

export function createUI() {
  const root = document.getElementById("hud-root");
  root.innerHTML = "";

  // Левый верхний угол
  const topLeft = document.createElement("div");
  topLeft.id = "top-left";
  topLeft.innerHTML = `
    <div>HP: <span id="ui-hp" class="value">100</span></div>
    <div>Bases: <span id="ui-base-r" class="value">1000</span> vs <span id="ui-base-d" class="value">1000</span></div>
    <div>Tip: ПКМ по земле — двигаться; ПКМ по врагу — атаковать</div>
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
  bottomBar.textContent = "Способности: Q W E R (заглушки)";
  root.appendChild(bottomBar);

  // Возвращаем API для обновления HUD
  const hpEl = topLeft.querySelector("#ui-hp");
  const baseREl = topLeft.querySelector("#ui-base-r");
  const baseDEl = topLeft.querySelector("#ui-base-d");
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
    }
  };
}

