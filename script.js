const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const toolSelect = document.getElementById('tool');
const clearBtn = document.getElementById('clear');

const state = {
  tool: toolSelect.value,
  drawing: false,
  stroke: [],
  items: [],
  particles: [],
};

const gravity = 1350;
const stick = {
  x: canvas.width * 0.35,
  y: canvas.height - 150,
  vx: 0,
  vy: 0,
  w: 22,
  h: 64,
  facing: 1,
  onGround: false,
  holding: null,
  swingTimer: 0,
  playTimer: 0,
};

const keys = new Set();

canvas.addEventListener('pointerdown', (e) => {
  state.drawing = true;
  state.stroke = [getPos(e)];
});

canvas.addEventListener('pointermove', (e) => {
  if (!state.drawing) return;
  state.stroke.push(getPos(e));
});

canvas.addEventListener('pointerup', () => {
  if (!state.drawing || state.stroke.length < 2) return endStroke();
  const item = createItemFromStroke(state.stroke, state.tool);
  state.items.push(item);
  popParticles(item);
  endStroke();
});

window.addEventListener('blur', () => keys.clear());
window.addEventListener('keydown', (e) => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'Space'].includes(e.key)) e.preventDefault();
  if (e.key.toLowerCase() === 'r') resetWorld();
  keys.add(e.key);
});
window.addEventListener('keyup', (e) => keys.delete(e.key));
toolSelect.addEventListener('change', (e) => (state.tool = e.target.value));
clearBtn.addEventListener('click', resetWorld);

function getPos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * canvas.width,
    y: ((e.clientY - rect.top) / rect.height) * canvas.height,
  };
}

function endStroke() {
  state.drawing = false;
  state.stroke = [];
}

function createItemFromStroke(points, type) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `item-${Date.now()}-${Math.random()}`,
    type,
    points,
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    vx: 0,
    vy: 0,
    held: false,
    bouncePower: type === 'bounce' ? 820 : 0,
    color: colorForType(type),
  };
}

function colorForType(type) {
  switch (type) {
    case 'sword':
      return '#9ae6ff';
    case 'platform':
      return '#c084fc';
    case 'bounce':
      return '#4ade80';
    default:
      return '#cbd5e1';
  }
}

function resetWorld() {
  state.items = [];
  state.particles = [];
  stick.x = canvas.width * 0.35;
  stick.y = canvas.height - 150;
  stick.vx = stick.vy = 0;
  stick.holding = null;
}

function update(dt) {
  const accel = 850;
  const maxSpeed = 280;
  const friction = 0.85;

  if (keys.has('ArrowLeft')) {
    stick.vx -= accel * dt;
    stick.facing = -1;
  }
  if (keys.has('ArrowRight')) {
    stick.vx += accel * dt;
    stick.facing = 1;
  }

  if ((keys.has(' ') || keys.has('Space') || keys.has('ArrowUp')) && stick.onGround) {
    stick.vy = -520;
    stick.onGround = false;
  }

  stick.vx = Math.max(-maxSpeed, Math.min(maxSpeed, stick.vx));
  stick.vy += gravity * dt;
  stick.x += stick.vx * dt;
  stick.y += stick.vy * dt;
  stick.onGround = false;

  const floor = canvas.height - 80;
  if (stick.y + stick.h > floor) {
    stick.y = floor - stick.h;
    stick.vy = 0;
    stick.onGround = true;
  }

  const foot = stick.y + stick.h;
  for (const item of state.items) {
    if (item.type === 'platform') {
      const onTop =
        foot <= item.y + 12 &&
        stick.y + stick.h * 0.8 < item.y + 2 &&
        stick.x + stick.w * 0.5 > item.x &&
        stick.x + stick.w * 0.5 < item.x + item.w;
      if (onTop && stick.vy >= 0 && foot >= item.y) {
        stick.y = item.y - stick.h;
        stick.vy = 0;
        stick.onGround = true;
      }
    }

    if (item.type === 'bounce' && overlap(stick, item)) {
      stick.vy = -item.bouncePower;
      stick.onGround = false;
      popParticles(item, '#4ade80');
    }
  }

  if (stick.x < 10) stick.x = 10;
  if (stick.x > canvas.width - stick.w - 10) stick.x = canvas.width - stick.w - 10;

  stick.vx *= stick.onGround ? friction : 0.99;

  handleSwordInteraction();
  updateItems(dt);
  updateParticles(dt);
}

function handleSwordInteraction() {
  if (stick.holding && stick.holding.type !== 'sword') {
    stick.holding = null;
  }

  if (!stick.holding) {
    for (const item of state.items) {
      if (item.type !== 'sword' || item.held) continue;
      const dist = distanceToItemCenter(stick, item);
      if (dist < 60) {
        stick.holding = item;
        item.held = true;
        stick.swingTimer = 0.5;
        stick.playTimer = 3.2;
        popParticles(item);
        break;
      }
    }
  }

  if (stick.holding) {
    const offsetX = stick.facing * 24;
    const offsetY = 10;
    stick.holding.x = stick.x + stick.w / 2 + offsetX;
    stick.holding.y = stick.y + offsetY;
    stick.holding.vx = stick.holding.vy = 0;

    if (stick.swingTimer > 0) {
      stick.swingTimer -= frameDelta;
    }
    if (stick.playTimer > 0) {
      stick.playTimer -= frameDelta;
    }

    if (stick.playTimer <= 0) {
      stick.holding.held = false;
      stick.holding.y = stick.y + stick.h + 4;
      stick.holding.x = stick.x + stick.facing * 28;
      stick.holding = null;
    }
  }
}

function updateItems(dt) {
  for (const item of state.items) {
    if (item.type === 'platform') continue;
    if (item.held) continue;

    item.vy += gravity * dt * 0.7;
    item.x += item.vx * dt;
    item.y += item.vy * dt;

    const ground = canvas.height - 60 - item.h;
    if (item.y > ground) {
      item.y = ground;
      item.vy = -item.vy * 0.25;
      item.vx *= 0.6;
      if (Math.abs(item.vy) < 30) item.vy = 0;
    }

    if (item.x < 0) item.x = 0;
    if (item.x + item.w > canvas.width) item.x = canvas.width - item.w;
  }
}

function updateParticles(dt) {
  state.particles = state.particles.filter((p) => p.life > 0);
  for (const p of state.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += gravity * 0.3 * dt;
  }
}

function popParticles(item, colorOverride) {
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;
  for (let i = 0; i < 12; i++) {
    state.particles.push({
      x: cx,
      y: cy,
      vx: (Math.random() - 0.5) * 280,
      vy: (Math.random() - 0.5) * 200,
      life: 0.4 + Math.random() * 0.3,
      color: colorOverride || item.color,
    });
  }
}

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function distanceToItemCenter(stickman, item) {
  const cx = item.x + item.w / 2;
  const cy = item.y + item.h / 2;
  const dx = stickman.x + stickman.w / 2 - cx;
  const dy = stickman.y + stickman.h / 2 - cy;
  return Math.hypot(dx, dy);
}

let last = performance.now();
let frameDelta = 0;
function loop(now) {
  frameDelta = Math.min(0.033, (now - last) / 1000);
  last = now;
  update(frameDelta);
  render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackdrop();
  drawItems();
  drawStick();
  drawStrokePreview();
  drawParticles();
}

function drawBackdrop() {
  const horizon = canvas.height - 90;
  const grad = ctx.createLinearGradient(0, horizon, 0, canvas.height);
  grad.addColorStop(0, 'rgba(255,255,255,0.02)');
  grad.addColorStop(1, 'rgba(255,255,255,0.08)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, horizon, canvas.width, canvas.height - horizon);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 10]);
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(canvas.width, horizon);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawItems() {
  for (const item of state.items) {
    ctx.save();
    ctx.translate(item.x, item.y);
    ctx.strokeStyle = item.color;
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    const [first, ...rest] = item.points;
    ctx.moveTo(first.x - item.x, first.y - item.y);
    for (const p of rest) ctx.lineTo(p.x - item.x, p.y - item.y);
    ctx.stroke();

    if (item.type === 'platform' || item.type === 'bounce') {
      ctx.fillStyle = item.type === 'bounce' ? 'rgba(74, 222, 128, 0.12)' : 'rgba(192, 132, 252, 0.12)';
      ctx.fillRect(0, 0, item.w, item.h || 12);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.strokeRect(0, 0, item.w, item.h || 12);
    }

    if (item.type === 'sword') {
      drawSwordDetails(item);
    }
    ctx.restore();
  }
}

function drawSwordDetails(item) {
  ctx.save();
  ctx.translate(0, 0);
  const cx = item.w / 2;
  const cy = item.h / 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy);
  ctx.lineTo(cx + 6, cy);
  ctx.stroke();

  ctx.fillStyle = 'rgba(250, 204, 21, 0.5)';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawStick() {
  const { x, y, w, h, facing } = stick;
  const swingAmt = stick.swingTimer > 0 ? Math.sin((0.5 - stick.swingTimer) * Math.PI * 2) * 12 : 0;

  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(facing, 1);

  // body
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // legs
  ctx.beginPath();
  ctx.moveTo(0, 14);
  ctx.lineTo(-8 + Math.sin(performance.now() / 180) * 2, 32);
  ctx.moveTo(0, 14);
  ctx.lineTo(8 - Math.sin(performance.now() / 180) * 2, 32);
  ctx.stroke();

  // torso
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(0, 14);
  ctx.stroke();

  // arms
  ctx.beginPath();
  ctx.moveTo(0, -4);
  ctx.lineTo(14, -2 + swingAmt);
  ctx.moveTo(0, -6);
  ctx.lineTo(-12, -2);
  ctx.stroke();

  // head
  ctx.beginPath();
  ctx.arc(0, -22, 10, 0, Math.PI * 2);
  ctx.stroke();

  // sword swoosh
  if (stick.holding && stick.holding.type === 'sword' && stick.swingTimer > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(16, -8, 18, Math.PI * 0.1, Math.PI * 1.2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawStrokePreview() {
  if (!state.drawing || state.stroke.length < 2) return;
  ctx.save();
  ctx.strokeStyle = state.tool === 'sword' ? '#9ae6ff' : '#f8fafc';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const [first, ...rest] = state.stroke;
  ctx.moveTo(first.x, first.y);
  for (const p of rest) ctx.lineTo(p.x, p.y);
  ctx.stroke();
  ctx.restore();
}

function drawParticles() {
  for (const p of state.particles) {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.max(0, p.life * 2);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}
