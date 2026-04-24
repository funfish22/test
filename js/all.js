const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const hud = {
  day: document.getElementById("day"),
  energy: document.getElementById("energy"),
  coins: document.getElementById("coins"),
  harvest: document.getElementById("harvest")
};

const TILE = 32;
const MAP_W = 24;
const MAP_H = 14;

const SPRITE = {
  frameW: 32,
  frameH: 48,
  drawW: 84,
  drawH: 126,
  rows: { idle: 0, walk: 1, run: 2, water: 3 },
  counts: { idle: 4, walk: 6, run: 6, water: 6 },
  fps: { idle: 5, walk: 10, run: 14, water: 12 }
};

const playerSpriteSheet = new Image();
playerSpriteSheet.src = "assets/farmer-spritesheet.svg";
let spriteReady = false;
playerSpriteSheet.addEventListener("load", () => {
  spriteReady = true;
});

const state = {
  day: 1,
  energy: 100,
  coins: 120,
  harvest: 0,
  cameraTime: 0,
  keys: new Set(),
  player: {
    x: 8,
    y: 7,
    bob: 0,
    action: "idle",
    frame: 0,
    frameTimer: 0,
    actionLock: 0
  },
  farmland: Array.from({ length: MAP_H }, () =>
    Array.from({ length: MAP_W }, () => ({ tilled: false, wet: 0, crop: 0 }))
  )
};

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function updateHud() {
  hud.day.textContent = state.day;
  hud.energy.textContent = state.energy;
  hud.coins.textContent = state.coins;
  hud.harvest.textContent = state.harvest;
}

function forCurrentTile(callback) {
  const tx = Math.floor(state.player.x);
  const ty = Math.floor(state.player.y);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return;
  callback(state.farmland[ty][tx], tx, ty);
}

function spendEnergy(cost) {
  if (state.energy < cost) return false;
  state.energy -= cost;
  return true;
}

function tillSoil() {
  if (!spendEnergy(4)) return;
  forCurrentTile((tile) => {
    tile.tilled = true;
    if (tile.crop === 0) tile.crop = 1;
  });
  updateHud();
}

function startWaterAction() {
  if (state.player.actionLock > 0 || !spendEnergy(2)) return;

  forCurrentTile((tile) => {
    if (!tile.tilled) return;
    tile.wet = 120;
    if (tile.crop > 0 && tile.crop < 4) {
      tile.crop += 1;
      if (tile.crop === 4) {
        state.coins += 25;
        state.harvest += 1;
      }
    }
  });

  state.player.action = "water";
  state.player.frame = 0;
  state.player.frameTimer = 0;
  state.player.actionLock = 0.5;
  updateHud();
}

function tickDay() {
  state.day += 1;
  state.energy = 100;
  for (const row of state.farmland) {
    for (const tile of row) {
      tile.wet = Math.max(0, tile.wet - 70);
      if (tile.crop === 4) tile.crop = 1;
    }
  }
  updateHud();
}

setInterval(tickDay, 18000);

window.addEventListener("keydown", (e) => {
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "f", "F", "Shift"].includes(e.key)) {
    e.preventDefault();
  }

  if (e.repeat && (e.key === " " || e.key.toLowerCase() === "f")) return;
  state.keys.add(e.key);

  if (e.key === " ") tillSoil();
  if (e.key.toLowerCase() === "f") startWaterAction();
});

window.addEventListener("keyup", (e) => {
  state.keys.delete(e.key);
});

function updatePlayerAnimation(dt, isMoving, isRunning) {
  const player = state.player;

  if (player.actionLock > 0) {
    player.actionLock = Math.max(0, player.actionLock - dt);
    player.action = "water";
  } else if (isMoving && isRunning) {
    player.action = "run";
  } else if (isMoving) {
    player.action = "walk";
  } else {
    player.action = "idle";
  }

  const fps = SPRITE.fps[player.action];
  const frameCount = SPRITE.counts[player.action];
  player.frameTimer += dt;

  if (player.frameTimer >= 1 / fps) {
    player.frameTimer = 0;
    player.frame = (player.frame + 1) % frameCount;
  }

  if (player.action !== "water" && player.frame >= frameCount) {
    player.frame = 0;
  }
}

function update(dt) {
  state.cameraTime += dt;
  let dx = 0;
  let dy = 0;

  if (state.keys.has("ArrowLeft")) dx -= 1;
  if (state.keys.has("ArrowRight")) dx += 1;
  if (state.keys.has("ArrowUp")) dy -= 1;
  if (state.keys.has("ArrowDown")) dy += 1;

  const moving = dx !== 0 || dy !== 0;
  const running = state.keys.has("Shift") && moving && state.player.actionLock <= 0;
  const speed = running ? 4.2 : 2.8;

  if (state.player.actionLock <= 0) {
    if (moving) {
      const len = Math.hypot(dx, dy) || 1;
      state.player.x = clamp(state.player.x + (dx / len) * speed * dt, 0, MAP_W - 1.02);
      state.player.y = clamp(state.player.y + (dy / len) * speed * dt, 0, MAP_H - 1.02);
    }
    state.player.bob += dt * (running ? 17 : moving ? 10 : 4);
  }

  updatePlayerAnimation(dt, moving, running);

  for (const row of state.farmland) {
    for (const tile of row) {
      tile.wet = Math.max(0, tile.wet - dt * 8);
    }
  }
}

function drawTile(x, y, tile) {
  const sx = x * TILE;
  const sy = y * TILE + 56;

  const base = (x + y) % 2 === 0 ? "#3f7f42" : "#4f8a4f";
  ctx.fillStyle = base;
  ctx.fillRect(sx, sy, TILE, TILE);

  if (tile.tilled) {
    ctx.fillStyle = tile.wet > 0 ? "#4d3a2b" : "#5f4734";
    ctx.fillRect(sx + 3, sy + 3, TILE - 6, TILE - 6);
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.moveTo(sx + 5, sy + 8 + i * 7);
      ctx.lineTo(sx + TILE - 5, sy + 8 + i * 7);
      ctx.stroke();
    }
  }

  if (tile.crop > 0) {
    const growth = tile.crop;
    ctx.fillStyle = ["#6da53f", "#85bb42", "#9bd34f", "#ffd468"][growth - 1];
    ctx.beginPath();
    ctx.ellipse(sx + 16, sy + 16 - growth * 1.8, 5 + growth, 8 + growth * 1.6, 0, 0, Math.PI * 2);
    ctx.fill();

    if (growth === 4) {
      ctx.fillStyle = "#ff9955";
      ctx.beginPath();
      ctx.arc(sx + 19, sy + 12, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawFallbackPlayer(px, py) {
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(px, py + 12, 12, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#f4c38f";
  ctx.fillRect(px - 6, py - 18, 12, 12);
  ctx.fillStyle = "#4a76d6";
  ctx.fillRect(px - 8, py - 6, 16, 16);
}

function drawPlayer() {
  const px = state.player.x * TILE + TILE / 2;
  const py = state.player.y * TILE + 56 + TILE / 2 + Math.sin(state.player.bob) * 1.2;

  if (!spriteReady) {
    drawFallbackPlayer(px, py);
    return;
  }

  const action = state.player.action;
  const frame = state.player.frame;
  const sx = frame * SPRITE.frameW;
  const sy = SPRITE.rows[action] * SPRITE.frameH;

  const drawX = px - SPRITE.drawW / 2;
  const drawY = py - 84;

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  const glow = ctx.createRadialGradient(px, py - 20, 10, px, py - 20, 48);
  glow.addColorStop(0, "rgba(120, 210, 255, 0.26)");
  glow.addColorStop(1, "rgba(120, 210, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(px - 48, py - 70, 96, 96);

  ctx.drawImage(
    playerSpriteSheet,
    sx,
    sy,
    SPRITE.frameW,
    SPRITE.frameH,
    drawX,
    drawY,
    SPRITE.drawW,
    SPRITE.drawH
  );

  ctx.restore();
}

function drawHd2dEffects(time) {
  const pulse = (Math.sin(time * 0.6) + 1) * 0.5;

  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "rgba(100, 160, 255, 0.2)");
  sky.addColorStop(1, "rgba(10, 24, 52, 0.58)");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = `rgba(255, 230, 165, ${0.06 + pulse * 0.05})`;
  ctx.beginPath();
  ctx.arc(750, 120, 160, 0, Math.PI * 2);
  ctx.fill();

  const vignette = ctx.createRadialGradient(480, 260, 180, 480, 260, 520);
  vignette.addColorStop(0, "rgba(0,0,0,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.03)";
  for (let i = 0; i < 60; i += 1) {
    const x = (i * 119 + time * 24) % canvas.width;
    const y = (i * 53) % canvas.height;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#26424f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < MAP_H; y += 1) {
    for (let x = 0; x < MAP_W; x += 1) {
      drawTile(x, y, state.farmland[y][x]);
    }
  }

  drawPlayer();
  drawHd2dEffects(state.cameraTime);
}

let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

updateHud();
requestAnimationFrame(loop);
