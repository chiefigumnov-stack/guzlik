import { Camera } from './camera.js';
import { InputManager } from './input.js';
import { UIOverlay } from './ui.js';
import { GameMap } from './map.js';
import { Hero, Creep, Tower, Building, Projectile, TEAM_RADIANT, TEAM_DIRE } from './entities.js';
import { createHeroFromDef, listHeroDefs } from './heroes.js';
import { buyItem, useItem, canUseShop, ITEMS } from './items.js';
import { clamp } from './utils.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new InputManager(canvas);
    this.camera = new Camera();
    this.ui = new UIOverlay(this);
    this.map = new GameMap();
    this.mode3p = true; // third-person control

    this.entities = [];
    this.toSpawn = [];
    this.elapsedTimeSec = 0;
    this.paused = false;
    this.gold = 600;
    this.gameOver = false;
    this.winner = null;
    // Runes
    this.runes = []; // {x,y,type,alive}
    this.nextRuneTime = 30; // first at 30s

    this._lastTime = performance.now();
    this._accum = 0;
    this._tickRate = 60; // fixed step
    this._dtFixed = 1 / this._tickRate;

    this.state = 'hero-select'; // 'hero-select' | 'playing' | 'game-over'
    this.initWorld();
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  handleResize() {
    // keep camera centered on hero
    this.centerCameraOnHero();
  }

  initWorld() {
    this.entities.length = 0;
    // Place neutral buildings (towers and ancients) first so selection UI can render over empty lane

    // Towers
    for (const t of this.map.radiantTowers) this.entities.push(new Tower({ team: TEAM_RADIANT, x: t.x, y: t.y, maxHp: 900, attackRange: 240, attackDamage: 28 }));
    for (const t of this.map.direTowers) this.entities.push(new Tower({ team: TEAM_DIRE, x: t.x, y: t.y, maxHp: 900, attackRange: 240, attackDamage: 28 }));

    // Ancient/buildings as bases
    const radiantAncient = new Building({ team: TEAM_RADIANT, x: this.map.radiantBase.x, y: this.map.radiantBase.y, maxHp: 2000, radius: 38, onDeath: () => this.endGame(TEAM_DIRE) });
    const direAncient = new Building({ team: TEAM_DIRE, x: this.map.direBase.x, y: this.map.direBase.y, maxHp: 2000, radius: 38, onDeath: () => this.endGame(TEAM_RADIANT) });
    this.entities.push(radiantAncient, direAncient);

    // Waves
    this.nextCreepWaveTime = 5; // seconds
    this.creepWaveInterval = 20; // faster waves for brawls

    // Setup selection list
    this.heroChoices = listHeroDefs();
    this.selectedHeroKey = null;
    this.enemyHeroKey = 'knight';
    // Spawn enemy placeholder to avoid null logic later; actual enemy will spawn on match start
    this.enemyHero = createHeroFromDef(this.enemyHeroKey, TEAM_DIRE, this.map.direBase.x - 60, this.map.direBase.y + 60);
    this.entities.push(this.enemyHero);
    // Center at mid-lane
    const mid = this.map.path[Math.floor(this.map.path.length / 2)];
    this.centerCameraAt(mid.x, mid.y);
  }

  endGame(winnerTeam) {
    this.gameOver = true; this.winner = winnerTeam; this.state = 'game-over';
  }

  spawn(entity) { this.toSpawn.push(entity); }

  centerCameraOnHero() { this.camera.x = this.hero.x; this.camera.y = this.hero.y; }
  centerCameraAt(x, y) { this.camera.x = x; this.camera.y = y; }

  handleInput() {
    const clicks = this.input.consumeClicks();
    if (this.state === 'hero-select') {
      if (clicks.left) this.handleHeroSelectClick();
      // Shop clicks during selection are ignored
      return;
    }
    // Third-person WASD movement overrides right-click moving
    if (this.mode3p && this.hero && this.hero.alive) {
      const forward = this.input.isKeyDown('w');
      const back = this.input.isKeyDown('s');
      const left = this.input.isKeyDown('a');
      const right = this.input.isKeyDown('d');
      if (forward || back || left || right) {
        const angle = (this._cameraYaw || 0);
        const vx = Math.cos(angle);
        const vz = Math.sin(angle);
        // Right vector
        const rx = Math.cos(angle + Math.PI / 2);
        const rz = Math.sin(angle + Math.PI / 2);
        let mx = 0, my = 0;
        if (forward) { mx += vx; my += vz; }
        if (back) { mx -= vx; my -= vz; }
        if (left) { mx -= rx; my -= rz; }
        if (right) { mx += rx; my += rz; }
        const len = Math.hypot(mx, my) || 1; mx /= len; my /= len;
        const speed = (this.hero.speed + (this.hero.speedBonus || 0) + (this.hero.speedBonusBuff || 0));
        this.hero.x += mx * speed * this._dtFixed;
        this.hero.y += my * speed * this._dtFixed;
        // Face toward movement
        this.hero.facing = Math.atan2(my, mx);
        // keep camera centered
        this.camera.x = this.hero.x; this.camera.y = this.hero.y;
      }
      // Mouse move rotates camera yaw
      const m = this.input.consumeMouseDelta();
      if (m.dx !== 0) {
        this._cameraYaw = (this._cameraYaw || 0) + m.dx * 0.003;
      }
    }
    // Right click: context order (attack-move or attack target if enemy under cursor)
    if (clicks.right) {
      const world = this.screenToWorld(this.input.mouseScreenX, this.input.mouseScreenY);
      // Find topmost entity under cursor
      let clicked = null; let bestDist = Infinity;
      for (const e of this.entities) {
        if (!e.alive || e.type === 'projectile') continue;
        const d = Math.hypot(world.x - e.x, world.y - e.y) - e.radius;
        if (d <= 8 && d < bestDist) { bestDist = d; clicked = e; }
      }
      if (clicked && this.hero.isEnemy(clicked)) {
        this.hero.attackOrderTargetId = clicked.id;
        this.hero.setMoveTarget(clicked.x, clicked.y);
      } else {
        // attack-move to point
        this.hero.attackOrderTargetId = null;
        this.hero.attackMovePointX = world.x; this.hero.attackMovePointY = world.y;
        this.hero.setMoveTarget(world.x, world.y);
      }
    }
    // Left-click on shop items to buy when near base
    if (clicks.left && this.state === 'playing') {
      const mx = this.input.mouseScreenX, my = this.input.mouseScreenY;
      const pad = 10; const items = Object.values(ITEMS); const cols = items.length; const w = Math.max(320, 20 + cols * 76), h = 116; const x = pad, y = this.canvas.height - h - pad;
      if (mx >= x && mx <= x + w && my >= y && my <= y + h) {
        if (canUseShop(this)) {
          const items = Object.values(ITEMS);
          for (let i = 0; i < items.length; i++) {
            const bx = x + 10 + i * 76; const by = y + 30; const bw = 72; const bh = 70;
            if (mx >= bx && mx <= bx + bw && my >= by && my <= by + bh) {
              buyItem(this, items[i].key);
              break;
            }
          }
        }
      }
    }
    // Q/E abilities
    if (this.input.isKeyDown('q')) {
      const world = this.screenToWorld(this.input.mouseScreenX, this.input.mouseScreenY);
      this.hero.castQ(this, world.x, world.y);
    }
    if (this.input.isKeyDown('w')) {
      const world = this.screenToWorld(this.input.mouseScreenX, this.input.mouseScreenY);
      this.hero.castW(this, world.x, world.y);
    }
    if (this.input.isKeyDown('e')) {
      this.hero.castE(this);
    }
    if (this.input.isKeyDown('r')) {
      const world = this.screenToWorld(this.input.mouseScreenX, this.input.mouseScreenY);
      this.hero.castR(this, world.x, world.y);
    }
    // Upgrade keys 1/2
    if (this.input.isKeyDown('1')) { this.hero.tryUpgradeAbility('q'); }
    if (this.input.isKeyDown('2')) { this.hero.tryUpgradeAbility('e'); }
    if (this.input.isKeyDown('9')) { this.hero.tryUpgradeAbility('w'); }
    if (this.input.isKeyDown('0')) { this.hero.tryUpgradeAbility('r'); }
    if (this.input.isKeyDown('p')) this.paused = true;
    if (this.input.isKeyDown('o')) this.paused = false;
    if (this.input.isKeyDown('k')) this.reset();

    this.camera.updateFromInput(this.input, this._dtFixed);

    // Item use keys 3-8
    if (this.input.isKeyDown('3')) useItem(this, 0);
    if (this.input.isKeyDown('4')) useItem(this, 1);
    if (this.input.isKeyDown('5')) useItem(this, 2);
    if (this.input.isKeyDown('6')) useItem(this, 3);
    if (this.input.isKeyDown('7')) useItem(this, 4);
    if (this.input.isKeyDown('8')) useItem(this, 5);
  }

  reset() {
    this.entities.length = 0; this.toSpawn.length = 0; this.gold = 600; this.elapsedTimeSec = 0; this.gameOver = false; this.winner = null; this.state = 'hero-select';
    this.initWorld();
  }

  loop(now) {
    const elapsedMs = now - this._lastTime; this._lastTime = now;
    this._accum += Math.min(0.25, elapsedMs / 1000);
    while (this._accum >= this._dtFixed) {
      this.update(this._dtFixed);
      this._accum -= this._dtFixed;
    }
    this.render();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    // Always process input (for selection/pause)
    this.handleInput();
    if (this.state === 'hero-select' || this.paused || this.gameOver) return;
    this.elapsedTimeSec += dt;

    // Spawn creep waves
    if (this.elapsedTimeSec >= this.nextCreepWaveTime) {
      this.spawnCreepWave();
      this.nextCreepWaveTime += this.creepWaveInterval;
    }

    // Simple enemy hero AI
    this.updateEnemyAI(dt);

    // Handle respawn timers
    if (!this.hero.alive) {
      if (this.hero.respawnTimer == null || this.hero.respawnTimer <= 0) {
        this.hero.respawnTimer = Math.max(4, Math.floor(2 + this.hero.level * 1.2));
      } else {
        this.hero.respawnTimer -= dt;
        if (this.hero.respawnTimer <= 0) this.respawnHero(this.hero);
      }
    }
    if (!this.enemyHero.alive) {
      if (this.enemyHero.respawnTimer == null || this.enemyHero.respawnTimer <= 0) {
        this.enemyHero.respawnTimer = Math.max(4, Math.floor(2 + this.enemyHero.level * 1.2));
      } else {
        this.enemyHero.respawnTimer -= dt;
        if (this.enemyHero.respawnTimer <= 0) this.respawnHero(this.enemyHero);
      }
    }

    // Rune spawns
    if (this.elapsedTimeSec >= this.nextRuneTime) {
      this.spawnRune();
      this.nextRuneTime += 45; // every 45s
    }

    // Update entities and collect dead
    for (const e of this.entities) e.update(dt, this);
    // Check rune pickups
    for (const r of this.runes) {
      if (!r.alive) continue;
      for (const u of [this.hero, this.enemyHero]) {
        if (!u.alive) continue;
        if (Math.hypot(u.x - r.x, u.y - r.y) <= (u.radius + 12)) {
          if (r.type === 'haste') { u.speedBonusBuff = 80; u.buffHasteTimer = 12; }
          else if (r.type === 'regen') { u.buffRegenTimer = 12; }
          else if (r.type === 'dd') { u.damageBuffMultiplier = 2; u.buffDDTimer = 12; }
          r.alive = false;
        }
      }
    }
    // Spawn deferred
    if (this.toSpawn.length) {
      this.entities.push(...this.toSpawn);
      this.toSpawn.length = 0;
    }
    // Clean up dead, apply last-hit rewards
    const alive = [];
    for (const e of this.entities) {
      if (!e.alive) {
        const killer = e._lastHitBy;
        if (e.goldBounty && killer && killer.id === this.hero.id) {
          this.gold += e.goldBounty;
          this.hero.grantXP(40);
        } else if (killer && killer.type === 'hero' && killer.team === this.hero.team) {
          this.hero.grantXP(20);
        }
      } else alive.push(e);
    }
    this.entities = alive;

    // Keep camera following hero a bit
    this.camera.x = this.hero.x; this.camera.y = this.hero.y;
  }

  spawnRune() {
    const spot = this.map.runeSpots[0];
    const types = ['haste', 'regen', 'dd'];
    const type = types[Math.floor(Math.random() * types.length)];
    this.runes = [{ x: spot.x, y: spot.y, type, alive: true }];
  }

  respawnHero(hero) {
    hero.alive = true;
    hero.hp = hero.maxHp;
    hero.mana = hero.maxMana;
    hero.respawnTimer = 0;
    if (hero.team === TEAM_RADIANT) { hero.x = this.map.radiantBase.x + 60; hero.y = this.map.radiantBase.y - 60; }
    else { hero.x = this.map.direBase.x - 60; hero.y = this.map.direBase.y + 60; }
    if (hero === this.hero) this.centerCameraOnHero();
  }

  updateEnemyAI(dt) {
    const path = [...this.map.path];
    // Enemy follows reverse path toward Radiant
    if (!this.enemyHero.aiIndex) this.enemyHero.aiIndex = path.length - 1;
    const target = path[this.enemyHero.aiIndex];
    this.enemyHero.setMoveTarget(target.x, target.y);
    const dx = target.x - this.enemyHero.x; const dy = target.y - this.enemyHero.y;
    if (Math.hypot(dx, dy) < 20 && this.enemyHero.aiIndex > 0) this.enemyHero.aiIndex--;
    // Retreat on low HP
    if (this.enemyHero.hp < this.enemyHero.maxHp * 0.35) {
      this.enemyHero.setMoveTarget(this.map.direBase.x, this.map.direBase.y);
    }
  }

  spawnCreepWave() {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const r = new Creep({ team: TEAM_RADIANT, x: this.map.radiantBase.x + 20, y: this.map.radiantBase.y - 20, path: this.map.path, maxHp: 240 });
      const d = new Creep({ team: TEAM_DIRE, x: this.map.direBase.x - 20, y: this.map.direBase.y + 20, path: [...this.map.path].reverse(), maxHp: 240 });
      r.x += i * 12; r.y -= i * 12; d.x -= i * 12; d.y += i * 12;
      this.entities.push(r, d);
    }
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    // If 3D mode, skip world background (HUD only)
    if (!this.mode3p) this.map.draw(ctx, this.camera);

    // Transform to world
    if (!this.mode3p) {
      ctx.save();
      this.camera.applyWorldTransform(ctx, ctx.canvas.width, ctx.canvas.height);

    // Runes
    for (const r of this.runes) {
      if (!r.alive) continue;
      ctx.fillStyle = r.type === 'haste' ? '#60a5fa' : r.type === 'regen' ? '#34d399' : '#f59e0b';
      ctx.beginPath(); ctx.arc(r.x, r.y, 10, 0, Math.PI * 2); ctx.fill();
    }

      // Entities
      for (const e of this.entities) this.drawEntity(ctx, e);
      ctx.restore();
    }

    // UI
    this.ui.drawWorldBars(ctx, this.camera);
    if (this.state === 'hero-select') this.drawHeroSelection(ctx);
    else this.ui.drawHUD(ctx);
    if (this.state === 'playing') this.drawShop(ctx);

    if (this.gameOver) this.drawGameOver(ctx);
  }

  drawShop(ctx) {
    ctx.save();
    ctx.resetTransform();
    const nearShop = canUseShop(this);
    const pad = 10;
    ctx.fillStyle = nearShop ? 'rgba(16,185,129,0.15)' : 'rgba(0,0,0,0.25)';
    const items = Object.values(ITEMS);
    const cols = items.length;
    const w = Math.max(320, 20 + cols * 76);
    const h = 116; const x = pad, y = ctx.canvas.height - h - pad;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#e2e8f0'; ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(nearShop ? 'Магазин (у базы)' : 'Магазин (слишком далеко)', x + 10, y + 22);
    ctx.font = '12px system-ui, sans-serif';
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const bx = x + 10 + i * 76; const by = y + 30; const bw = 72; const bh = 70;
      ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.strokeRect(bx, by, bw, bh);
      drawItemIcon(ctx, bx + 8, by + 8, bw - 16, it.key);
      ctx.fillStyle = '#e2e8f0'; ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(it.name, bx + 6, by + 46);
      ctx.fillStyle = 'rgba(226,232,240,0.8)'; ctx.font = '10px system-ui, sans-serif';
      const lines = wrapText(ctx, it.desc, bw - 12);
      if (lines[0]) ctx.fillText(lines[0], bx + 6, by + 58);
      ctx.fillStyle = '#fbbf24'; ctx.font = '11px system-ui, sans-serif';
      ctx.fillText(`${it.cost}g`, bx + 6, by + 70);
    }
    ctx.restore();
  }

  handleHeroSelectClick() {
    const ctx = this.ctx;
    const { width, height } = ctx.canvas;
    const mx = this.input.mouseScreenX, my = this.input.mouseScreenY;
    const cards = this.getHeroCardsLayout(width, height);
    for (const card of cards) {
      if (mx >= card.x && mx <= card.x + card.w && my >= card.y && my <= card.y + card.h) {
        this.startMatchWithHero(card.key);
        break;
      }
    }
  }

  startMatchWithHero(heroKey) {
    this.selectedHeroKey = heroKey;
    // Replace placeholder enemy and spawn real heroes
    this.entities = this.entities.filter((e) => e.type !== 'hero');
    this.hero = createHeroFromDef(heroKey, TEAM_RADIANT, this.map.radiantBase.x + 60, this.map.radiantBase.y - 60);
    this.hero.inventory = Array(6).fill(null);
    this.enemyHero = createHeroFromDef(this.enemyHeroKey, TEAM_DIRE, this.map.direBase.x - 60, this.map.direBase.y + 60);
    this.entities.push(this.hero, this.enemyHero);
    this.centerCameraOnHero();
    this.state = 'playing';
  }

  drawHeroSelection(ctx) {
    ctx.save();
    ctx.resetTransform();
    const { width, height } = ctx.canvas;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 28px system-ui, sans-serif';
    const title = 'Выбор героя';
    ctx.fillText(title, width / 2 - ctx.measureText(title).width / 2, 100);
    const cards = this.getHeroCardsLayout(width, height);
    for (const card of cards) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(card.x, card.y, card.w, card.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.strokeRect(card.x, card.y, card.w, card.h);
      ctx.fillStyle = card.color;
      ctx.fillRect(card.x + 10, card.y + 10, 60, 60);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(card.title, card.x + 84, card.y + 32);
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText('ЛКМ — выбрать', card.x + 84, card.y + 54);
    }
    ctx.restore();
  }

  getHeroCardsLayout(width, height) {
    const defs = listHeroDefs();
    const total = defs.length;
    const cardW = 260, cardH = 90;
    const gap = 16;
    const totalW = total * cardW + (total - 1) * gap;
    const startX = Math.max(16, Math.floor(width / 2 - totalW / 2));
    const y = Math.floor(height / 2 - cardH / 2);
    return defs.map((d, i) => ({ key: d.key, title: d.title, color: d.color, x: startX + i * (cardW + gap), y, w: cardW, h: cardH }));
  }

  drawGameOver(ctx) {
    ctx.save();
    ctx.resetTransform();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 36px system-ui, sans-serif';
    const text = this.winner === TEAM_RADIANT ? 'Победа: Радиант' : 'Победа: Тьма';
    ctx.fillText(text, ctx.canvas.width / 2 - ctx.measureText(text).width / 2, ctx.canvas.height / 2);
    ctx.font = '16px system-ui, sans-serif';
    const sub = 'Нажмите R для рестарта';
    ctx.fillText(sub, ctx.canvas.width / 2 - ctx.measureText(sub).width / 2, ctx.canvas.height / 2 + 30);
    ctx.restore();
  }

  drawEntity(ctx, e) {
    ctx.save();
    if (e.type === 'projectile') {
      // stylized projectile
      ctx.strokeStyle = e.team === TEAM_RADIANT ? '#f59e0b' : '#a78bfa';
      ctx.fillStyle = e.team === TEAM_RADIANT ? 'rgba(245,158,11,0.2)' : 'rgba(167,139,250,0.2)';
      ctx.beginPath(); ctx.arc(e.x, e.y, e.radius + 1.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore(); return;
    }
    if (e.type === 'tower') {
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(e.x + 6, e.y + 10, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.team === TEAM_RADIANT ? '#34d399' : '#f87171';
      ctx.fillRect(e.x - 14, e.y - 24, 28, 38);
      ctx.restore(); return;
    }
    if (e.type === 'building') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(e.x + 6, e.y + 10, e.radius, e.radius * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.team === TEAM_RADIANT ? '#16a34a' : '#dc2626';
      ctx.beginPath(); ctx.arc(e.x, e.y - 6, e.radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); return;
    }
    if (e.type === 'hero') {
      // shadow
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(e.x + 6, e.y + 10, e.radius + 2, (e.radius + 2) * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      // body
      ctx.fillStyle = e.team === TEAM_RADIANT ? '#93c5fd' : '#fca5a5';
      if (e.hitFlash > 0) ctx.fillStyle = '#fde047';
      ctx.beginPath(); ctx.arc(e.x, e.y - 4, e.radius, 0, Math.PI * 2); ctx.fill();
      // selection ring on player hero
      if (this.hero && e.id === this.hero.id) {
        ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y + 2, e.radius + 3, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore(); return;
    }
    if (e.type === 'creep' || e.type === 'unit') {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.ellipse(e.x + 4, e.y + 8, e.radius, e.radius * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = e.team === TEAM_RADIANT ? '#10b981' : '#ef4444';
      if (e.hitFlash > 0) ctx.fillStyle = '#fde047';
      ctx.beginPath(); ctx.arc(e.x, e.y - 2, e.radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore(); return;
    }
    // default
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(e.x - 4, e.y - 4, 8, 8);
    ctx.restore();
  }

  screenToWorld(sx, sy) {
    // Inverse of applyWorldTransform
    const cx = sx - this.canvas.width / 2;
    const cy = sy - this.canvas.height / 2;
    let x = cx, y = cy;
    if (this.camera.mode === 'iso') {
      const invScaleX = 1 / this.camera.scale;
      const invScaleY = 1 / (this.camera.scale * this.camera.isoYScale);
      const rx = x * invScaleX;
      const ry = y * invScaleY;
      // inverse rotate by +45deg
      const cos = Math.cos(Math.PI / 4), sin = Math.sin(Math.PI / 4);
      const wx = rx * cos - ry * sin;
      const wy = rx * sin + ry * cos;
      x = wx + this.camera.x;
      y = wy + this.camera.y;
    } else {
      x = x / this.camera.scale + this.camera.x;
      y = y / this.camera.scale + this.camera.y;
    }
    return { x, y };
  }
}

// Helpers used by drawShop (module-scope)
function drawItemIcon(ctx, x, y, size, key) {
  ctx.save();
  const colorMap = {
    clarity: '#60a5fa', salve: '#34d399', boots: '#eab308', wand: '#a78bfa',
    lifesteal_mask: '#ef4444', claymore: '#f97316', magic_cloak: '#64748b', tp_scroll: '#22d3ee'
  };
  ctx.fillStyle = colorMap[key] || '#94a3b8';
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(x, y + size - 8, size, 8);
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width <= maxWidth) line = test; else { lines.push(line); line = w; }
    if (lines.length === 1) break;
  }
  if (line) lines.push(line);
  return lines.slice(0, 1);
}

