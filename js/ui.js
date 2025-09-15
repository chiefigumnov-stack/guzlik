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
    <div>Score: <span id="ui-score" class="value">0</span></div>
  `;
  root.appendChild(topLeft);

  // Центровой прицел
  const crosshair = document.createElement("div");
  crosshair.id = "crosshair";
  root.appendChild(crosshair);

  // Нижняя панель
  const bottomBar = document.createElement("div");
  bottomBar.id = "bottom-bar";
  bottomBar.textContent = "Ammo: ∞ | Abilities: [Q] Dash (N/A), [E] AoE (N/A)";
  root.appendChild(bottomBar);

  // Возвращаем API для обновления HUD
  const hpEl = topLeft.querySelector("#ui-hp");
  const scoreEl = topLeft.querySelector("#ui-score");

  return {
    setHP(value) {
      hpEl.textContent = String(Math.max(0, Math.floor(value)));
    },
    setScore(value) {
      scoreEl.textContent = String(value);
    },
  };
}

