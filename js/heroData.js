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
  "CM-01": {
    name: "Граф Антуан де Валуа",
    role: "Философ, граф",
    age: 34,
    portrait: "https://i.ibb.co/bRGgWW1f/antuan.jpg",
    usePortraitBillboard: false,
    // Временная бесплатная стилизованная (аниме-стайл) модель
    modelUrl: "https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/RobotExpressive/glTF-Binary/RobotExpressive.glb",
    base: {
      maxHp: 650,
      attackDamage: 30,
      attackRange: 3.5,
      attackCooldown: 0.85,
      moveSpeed: 10.5,
    },
    growth: {
      maxHp: 85,
      attackDamage: 3,
      attackRange: 0.0,
      attackCooldown: -0.02,
      moveSpeed: 0.1,
    },
  },
};

