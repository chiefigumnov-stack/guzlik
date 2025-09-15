// heroData.js
// Определения героев: модель, базовые статы и рост за уровень

export const HERO_DEFS = {
  avocado: {
    name: "Avocado",
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Avocado/glTF/Avocado.gltf",
    base: {
      maxHp: 600,
      attackDamage: 28,
      attackRange: 3.5,
      attackCooldown: 0.9,
      moveSpeed: 10,
    },
    growth: {
      maxHp: 80,
      attackDamage: 3,
      attackRange: 0.0,
      attackCooldown: -0.015, // немного быстрее
      moveSpeed: 0.1,
    },
  },
};

