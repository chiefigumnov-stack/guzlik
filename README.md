MOBA Prototype (Three.js)

Браузерный прототип MOBA на JavaScript + Three.js (WebGL).

Запуск

- Распакуйте архив (если скачали zip) или скопируйте папку проекта.
- Откройте index.html через локальный сервер (рекомендуется):
  - Python 3: python3 -m http.server 8080 и зайдите на http://localhost:8080
  - Node (serve): npx serve . и перейдите по ссылке в консоли
  - VSCode Live Server: правый клик по index.html → Open with Live Server

Прямое открытие файла index.html через file:// может блокировать загрузку GLTF из GitHub (CORS). Используйте http-сервер.

Управление

- WASD — движение
- Мышь — прицеливание (герой поворачивается к курсору)
- ЛКМ — базовая атака (снаряд по направлению героя)

Архитектура

- index.html — точка входа, подключает js/game.js
- js/game.js — сцена, камера (угол 60°), свет, земля 50x50, rAF-цикл, Raycaster
- js/player.js — игрок (GLTF Avocado), хп-бар, стрельба, пули, HUD-обновление
- js/enemy.js — враги (GLTF BoomBox), спавн каждые 3с по краям, преследование, контактный урон, хп-бар
- js/ui.js — HUD (HP/Score слева-верх, прицел в центре, панель снизу)
- js/network.js — заглушка мультиплеера (connect/send/onReceive)

Замена моделей

В js/player.js и js/enemy.js есть константы HERO_URL и ENEMY_URL.

- Замените ссылки на GLTF/GLB ваших моделей (Sketchfab/VRoid/CDN).
- Модели масштабируются по bounding box до разумного размера.
- При необходимости подправьте позицию/масштаб после загрузки.

Ассеты

- Текстура земли: Three.js examples (grasslight-big.jpg)
- Модели GLTF: glTF-Sample-Models (Avocado, BoomBox) — для прототипа

Идеи для расширения

- Анимации (AnimationMixer) для героя/врагов
- Способности, перезарядка, разные типы снарядов
- Навигация/pathfinding для врагов
- Настоящий мультиплеер (WebSocket/WebRTC)
