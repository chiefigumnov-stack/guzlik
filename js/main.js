// main.js
// Точка входа: показывает лобби/выбор героя, затем подгружает игру

import { createUI } from "./ui.js";
import { HERO_DEFS } from "./heroData.js";

function toHeroList() {
  return Object.entries(HERO_DEFS).map(([key, def]) => ({ key, ...def }));
}

window.addEventListener("DOMContentLoaded", async () => {
  const ui = createUI();
  ui.showHeroSelect(toHeroList(), async (heroKey) => {
    window.__chosenHeroKey = heroKey;
    const gameMod = await import("./game.js");
    gameMod.startGame();
  });
});

