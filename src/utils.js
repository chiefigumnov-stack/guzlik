export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function distanceSquared(ax, ay, bx, by) {
  const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy;
}

export function distance(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function normalize(x, y) {
  const len = Math.hypot(x, y) || 1; return { x: x / len, y: y / len };
}

export function angle(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

export function generateId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36).slice(4);
}

export function nowSeconds() {
  return performance.now() / 1000;
}

