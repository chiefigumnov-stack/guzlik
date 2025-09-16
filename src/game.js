import { Camera } from './camera.js';
import { InputManager } from './input.js';
import { UIOverlay } from './ui.js';
import { GameMap } from './map.js';
import { Hero, Creep, Tower, Building, Projectile, TEAM_RADIANT, TEAM_DIRE } from './entities.js';
import { createHeroFromDef, listHeroDefs } from './heroes.js';
import { clamp } from './utils.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.input = new InputManager(canvas);
    this.camera = new Camera();
    this.ui = new UIOverlay(this);
    this.map = new GameMap();

    this.entities = [];
    this.toSpawn = [];
    this.elapsedTimeSec = 0;
    this.paused = false;
    this.gold = 600;
    this.gameOver = false;
    this.winner = null;

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
      return;
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
    // Q/E abilities
    if (this.input.isKeyDown('q')) {
      const world = this.screenToWorld(this.input.mouseScreenX, this.input.mouseScreenY);
      this.hero.castQ(this, world.x, world.y);
    }
    if (this.input.isKeyDown('e')) {
      this.hero.castE(this);
    }
    // Upgrade keys 1/2
    if (this.input.isKeyDown('1')) { this.hero.tryUpgradeAbility('q'); }
    if (this.input.isKeyDown('2')) { this.hero.tryUpgradeAbility('e'); }
    if (this.input.isKeyDown('p')) this.paused = true;
    if (this.input.isKeyDown('o')) this.paused = false;
    if (this.input.isKeyDown('r')) this.reset();

    this.camera.updateFromInput(this.input, this._dtFixed);
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

    // Update entities and collect dead
    for (const e of this.entities) e.update(dt, this);
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
    this.map.draw(ctx, this.camera);

    // Transform to world
    ctx.save();
    this.camera.applyWorldTransform(ctx, ctx.canvas.width, ctx.canvas.height);

    // Entities
    for (const e of this.entities) this.drawEntity(ctx, e);
    ctx.restore();

    // UI
    this.ui.drawWorldBars(ctx, this.camera);
    if (this.state === 'hero-select') this.drawHeroSelection(ctx);
    else this.ui.drawHUD(ctx);

    if (this.gameOver) this.drawGameOver(ctx);
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

