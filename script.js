const menuToggle = document.querySelector('.menu-toggle');
const navigation = document.querySelector('#primary-navigation');

if (menuToggle && navigation) {
  menuToggle.addEventListener('click', () => {
    const isOpen = navigation.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navigation.addEventListener('click', (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      navigation.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  });
}

const canvas = document.querySelector('#game-board');
const context = canvas?.getContext('2d');
const scoreElement = document.querySelector('#score');
const highScoreElement = document.querySelector('#high-score');
const messageElement = document.querySelector('#game-message');
const enemyCountElement = document.querySelector('#enemy-count');
const startButton = document.querySelector('#start-game');
const pauseButton = document.querySelector('#pause-game');
const restartButton = document.querySelector('#restart-game');
const touchButtons = document.querySelectorAll('[data-direction]');
const airplaneCanvas = document.querySelector('#airplane-board');
const airplaneContext = airplaneCanvas?.getContext('2d');
const airplaneStartButton = document.querySelector('#airplane-start');
const airplanePauseButton = document.querySelector('#airplane-pause');
const airplaneRestartButton = document.querySelector('#airplane-restart');
const airplaneMessageElement = document.querySelector('#airplane-message');
const airplaneGame = {
  animationId: null,
  running: false,
  paused: false,
  score: 0,
  kills: 0,
  health: 4,
  player: { x: 180, y: 420 },
  enemies: [],
  bullets: [],
  enemyBullets: [],
  bossSpawned: false,
  keys: new Set(),
  lastFrame: 0,
  spawnTimer: 0,
  shotTimer: 0,
  invulnerableUntil: 0,
};
const airplaneScoreElement = document.querySelector('#airplane-score');
const airplaneHealthElement = document.querySelector('#airplane-health');

const GRID_SIZE = 20;
const CELL_SIZE = 18;
const TICK_MS = 180;
const ENEMY_COUNT = 5;
const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const directionNames = Object.keys(DIRECTIONS);

let snake = [];
let food = { x: 10, y: 10 };
let enemies = [];
let explosions = [];
let direction = DIRECTIONS.right;
let nextDirection = DIRECTIONS.right;
let timerId = null;
let running = false;
let paused = false;
let gameOver = false;
let score = 0;
let highScore = readHighScore();
let previousSnake = [];
let previousEnemies = [];
let lastStepAt = 0;
let renderFrameId = null;

function readHighScore() {
  try {
    return Number.parseInt(localStorage.getItem('apple-snake-high-score') || '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveHighScore() {
  try {
    localStorage.setItem('apple-snake-high-score', String(highScore));
  } catch {
    // The game remains playable when storage is unavailable.
  }
}

function randomCell() {
  return { x: Math.floor(Math.random() * GRID_SIZE), y: Math.floor(Math.random() * GRID_SIZE) };
}

function sameCell(first, second) {
  return first.x === second.x && first.y === second.y;
}

function occupied(cell) {
  return snake.some((segment) => sameCell(segment, cell)) || enemies.some((enemy) => sameCell(enemy, cell));
}

function newOpenCell() {
  let cell = randomCell();
  let attempts = 0;
  while (occupied(cell) && attempts < 100) {
    cell = randomCell();
    attempts += 1;
  }
  return cell;
}

function updateScore() {
  scoreElement.textContent = String(score);
  highScoreElement.textContent = String(highScore);
  enemyCountElement.textContent = String(enemies.length || ENEMY_COUNT);
}

function updateAirplaneStats() {
  if (airplaneScoreElement) airplaneScoreElement.textContent = String(airplaneGame.score);
  if (airplaneHealthElement) airplaneHealthElement.textContent = String(airplaneGame.health);
}

function drawAirplane() {
  if (!airplaneContext || !airplaneCanvas) return;
  airplaneContext.clearRect(0, 0, airplaneCanvas.width, airplaneCanvas.height);
  airplaneContext.fillStyle = '#071426';
  airplaneContext.fillRect(0, 0, airplaneCanvas.width, airplaneCanvas.height);

  airplaneContext.fillStyle = '#38bdf8';
  airplaneContext.beginPath();
  airplaneContext.moveTo(airplaneGame.player.x, airplaneGame.player.y - 16);
  airplaneContext.lineTo(airplaneGame.player.x - 16, airplaneGame.player.y + 14);
  airplaneContext.lineTo(airplaneGame.player.x, airplaneGame.player.y + 8);
  airplaneContext.lineTo(airplaneGame.player.x + 16, airplaneGame.player.y + 14);
  airplaneContext.closePath();
  airplaneContext.fill();

  airplaneGame.enemies.forEach((enemy) => {
    const isBoss = enemy.kind === 'boss';
    airplaneContext.fillStyle = isBoss ? '#c084fc' : '#f87171';
    airplaneContext.beginPath();
    airplaneContext.moveTo(enemy.x, enemy.y + (isBoss ? 28 : 14));
    airplaneContext.lineTo(enemy.x - (isBoss ? 28 : 14), enemy.y - (isBoss ? 22 : 12));
    airplaneContext.lineTo(enemy.x, enemy.y - (isBoss ? 12 : 6));
    airplaneContext.lineTo(enemy.x + (isBoss ? 28 : 14), enemy.y - (isBoss ? 22 : 12));
    airplaneContext.closePath();
    airplaneContext.fill();
    if (isBoss) {
      airplaneContext.fillStyle = '#fef08a';
      airplaneContext.fillRect(enemy.x - 22, enemy.y - 34, 44 * (enemy.health / 8), 4);
    }
  });

  airplaneContext.fillStyle = '#facc15';
  airplaneGame.bullets.forEach((bullet) => airplaneContext.fillRect(bullet.x - 2, bullet.y - 8, 4, 10));
  airplaneContext.fillStyle = '#fb923c';
  airplaneGame.enemyBullets.forEach((bullet) => airplaneContext.fillRect(bullet.x - 2, bullet.y, 4, 9));
}

function resetAirplaneGame() {
  airplaneGame.running = false;
  airplaneGame.paused = false;
  airplaneGame.score = 0;
  airplaneGame.kills = 0;
  airplaneGame.health = 4;
  airplaneGame.player = { x: 180, y: 420 };
  airplaneGame.enemies = [];
  airplaneGame.bullets = [];
  airplaneGame.enemyBullets = [];
  airplaneGame.bossSpawned = false;
  airplaneGame.keys.clear();
  airplaneGame.lastFrame = 0;
  airplaneGame.spawnTimer = 0;
  airplaneGame.shotTimer = 0;
  airplaneGame.invulnerableUntil = 0;
  if (airplanePauseButton) airplanePauseButton.disabled = true;
  updateAirplaneStats();
  drawAirplane();
}

function damageAirplane() {
  const now = performance.now();
  if (now < airplaneGame.invulnerableUntil || !airplaneGame.running) return;
  airplaneGame.invulnerableUntil = now + 700;
  airplaneGame.health = Math.max(0, airplaneGame.health - 1);
  updateAirplaneStats();
  if (airplaneGame.health === 0) {
    airplaneGame.running = false;
    if (airplaneGame.animationId !== null) window.cancelAnimationFrame(airplaneGame.animationId);
    airplaneGame.animationId = null;
    if (airplanePauseButton) airplanePauseButton.disabled = true;
    if (airplaneMessageElement) airplaneMessageElement.textContent = '게임 오버 — 재시작해 다시 도전하세요.';
  } else if (airplaneMessageElement) {
    airplaneMessageElement.textContent = `피격! 남은 체력 ${airplaneGame.health} — 적의 공격을 피하세요.`;
  }
}

function spawnAirplaneEnemy() {
  airplaneGame.enemies.push({
    x: 24 + Math.random() * (airplaneCanvas.width - 48),
    y: -20,
    speed: 55 + Math.random() * 35,
    shotTimer: 700 + Math.random() * 900,
    kind: 'regular',
  });
}

function spawnAirplaneBoss() {
  if (airplaneGame.bossSpawned) return;
  airplaneGame.bossSpawned = true;
  airplaneGame.enemies.push({ x: airplaneCanvas.width / 2, y: -42, speed: 28, shotTimer: 450, health: 8, kind: 'boss' });
  if (airplaneMessageElement) airplaneMessageElement.textContent = '보스 출현! 집중해서 공격하세요.';
}

function fireAirplane() {
  if (!airplaneGame.running || airplaneGame.paused || airplaneGame.shotTimer > 0) return;
  airplaneGame.bullets.push({ x: airplaneGame.player.x, y: airplaneGame.player.y - 18, speed: 360 });
  airplaneGame.shotTimer = 220;
}

function airplaneFrame(timestamp) {
  if (!airplaneGame.running) return;
  airplaneGame.animationId = window.requestAnimationFrame(airplaneFrame);
  if (airplaneGame.paused) return;
  const delta = airplaneGame.lastFrame ? Math.min(32, timestamp - airplaneGame.lastFrame) : 16;
  airplaneGame.lastFrame = timestamp;
  const seconds = delta / 1000;
  const movement = 220 * seconds;
  if (airplaneGame.keys.has('up')) airplaneGame.player.y -= movement;
  if (airplaneGame.keys.has('down')) airplaneGame.player.y += movement;
  if (airplaneGame.keys.has('left')) airplaneGame.player.x -= movement;
  if (airplaneGame.keys.has('right')) airplaneGame.player.x += movement;
  airplaneGame.player.x = Math.max(18, Math.min(airplaneCanvas.width - 18, airplaneGame.player.x));
  airplaneGame.player.y = Math.max(22, Math.min(airplaneCanvas.height - 22, airplaneGame.player.y));

  airplaneGame.spawnTimer += delta;
  if (airplaneGame.spawnTimer >= 900) {
    airplaneGame.spawnTimer = 0;
    spawnAirplaneEnemy();
  }
  airplaneGame.shotTimer = Math.max(0, airplaneGame.shotTimer - delta);
  airplaneGame.bullets = airplaneGame.bullets
    .map((bullet) => ({ ...bullet, y: bullet.y - bullet.speed * seconds }))
    .filter((bullet) => bullet.y > -12);
  airplaneGame.enemies = airplaneGame.enemies
    .map((enemy) => {
      const nextEnemy = { ...enemy, y: enemy.y + enemy.speed * seconds, shotTimer: enemy.shotTimer - delta };
      if (nextEnemy.shotTimer <= 0 && nextEnemy.y > 0) {
        airplaneGame.enemyBullets.push({ x: nextEnemy.x, y: nextEnemy.y + 12, speed: 170 });
        nextEnemy.shotTimer = 1000 + Math.random() * 900;
      }
      return nextEnemy;
    })
    .filter((enemy) => enemy.y < airplaneCanvas.height + 24);
  airplaneGame.enemyBullets = airplaneGame.enemyBullets
    .map((bullet) => ({ ...bullet, y: bullet.y + bullet.speed * seconds }))
    .filter((bullet) => bullet.y < airplaneCanvas.height + 12);

  airplaneGame.bullets = airplaneGame.bullets.filter((bullet) => {
    const hitIndex = airplaneGame.enemies.findIndex((enemy) => Math.hypot(enemy.x - bullet.x, enemy.y - bullet.y) < 20);
    if (hitIndex < 0) return true;
    const enemy = airplaneGame.enemies[hitIndex];
    if (enemy.kind === 'boss') {
      enemy.health -= 1;
      if (enemy.health <= 0) {
        airplaneGame.enemies.splice(hitIndex, 1);
        airplaneGame.score += 10;
        updateAirplaneStats();
        if (airplaneMessageElement) airplaneMessageElement.textContent = '보스 격파! +10점';
      }
    } else {
      airplaneGame.enemies.splice(hitIndex, 1);
      airplaneGame.kills += 1;
      airplaneGame.score += 1;
      updateAirplaneStats();
      if (airplaneGame.kills >= 5) spawnAirplaneBoss();
    }
    return false;
  });
  airplaneGame.enemies = airplaneGame.enemies.filter((enemy) => {
    const collisionDistance = enemy.kind === 'boss' ? 44 : 24;
    if (Math.hypot(enemy.x - airplaneGame.player.x, enemy.y - airplaneGame.player.y) >= collisionDistance) return true;
    damageAirplane();
    return false;
  });
  airplaneGame.enemyBullets = airplaneGame.enemyBullets.filter((bullet) => {
    if (Math.hypot(bullet.x - airplaneGame.player.x, bullet.y - airplaneGame.player.y) >= 20) return true;
    damageAirplane();
    return false;
  });
  drawAirplane();
}

function startAirplaneGame() {
  if (airplaneGame.animationId !== null) window.cancelAnimationFrame(airplaneGame.animationId);
  resetAirplaneGame();
  airplaneGame.running = true;
  airplaneGame.lastFrame = performance.now();
  airplaneGame.animationId = window.requestAnimationFrame(airplaneFrame);
  if (airplanePauseButton) {
    airplanePauseButton.disabled = false;
    airplanePauseButton.textContent = '일시정지';
  }
  if (airplaneMessageElement) airplaneMessageElement.textContent = '비행 중 — 적을 피하고 Space로 공격하세요.';
  airplaneCanvas?.focus();
}

function toggleAirplanePause() {
  if (!airplaneGame.running) return;
  airplaneGame.paused = !airplaneGame.paused;
  if (airplanePauseButton) airplanePauseButton.textContent = airplaneGame.paused ? '계속하기' : '일시정지';
  if (airplaneMessageElement) airplaneMessageElement.textContent = airplaneGame.paused ? '일시정지 중' : '비행 중 — 적을 피하고 Space로 공격하세요.';
}

function resetGame() {
  snake = [{ x: 5, y: 10 }, { x: 4, y: 10 }, { x: 3, y: 10 }];
  direction = DIRECTIONS.right;
  nextDirection = DIRECTIONS.right;
  score = 0;
  gameOver = false;
  paused = false;
  explosions = [];
  enemies = [];
  for (let index = 0; index < ENEMY_COUNT; index += 1) {
    enemies.push(newOpenCell());
  }
  food = newOpenCell();
  previousSnake = snake.map((segment) => ({ ...segment }));
  previousEnemies = enemies.map((enemy) => ({ ...enemy }));
  lastStepAt = performance.now();
  updateScore();
  draw();
}

function startRenderLoop() {
  if (renderFrameId !== null) return;
  const renderFrame = (timestamp) => {
    draw(Math.min(1, (timestamp - lastStepAt) / TICK_MS));
    renderFrameId = window.requestAnimationFrame(renderFrame);
  };
  renderFrameId = window.requestAnimationFrame(renderFrame);
}

function stopRenderLoop() {
  if (renderFrameId !== null) {
    window.cancelAnimationFrame(renderFrameId);
    renderFrameId = null;
  }
}

function startGame() {
  if (timerId !== null) clearInterval(timerId);
  resetGame();
  running = true;
  startRenderLoop();
  canvas?.focus();
  pauseButton.disabled = false;
  pauseButton.textContent = '일시정지';
  messageElement.textContent = '게임 중 — 먹이를 먹고 적을 피하세요.';
  timerId = window.setInterval(gameTick, TICK_MS);
}

function endGame(message) {
  running = false;
  gameOver = true;
  paused = false;
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
  stopRenderLoop();
  pauseButton.disabled = true;
  messageElement.textContent = message;
  draw();
}

function togglePause() {
  if (!running || gameOver) return;
  paused = !paused;
  pauseButton.textContent = paused ? '계속하기' : '일시정지';
  messageElement.textContent = paused ? '일시정지 중' : '게임 중 — 먹이를 먹고 적을 피하세요.';
  draw();
}

function setDirection(name) {
  const requested = DIRECTIONS[name];
  if (!requested || (requested.x === -direction.x && requested.y === -direction.y)) return;
  nextDirection = requested;
}

function moveEnemies() {
  enemies = enemies.map((enemy) => {
    const choices = directionNames
      .map((name) => DIRECTIONS[name])
      .filter((candidate) => {
        const next = { x: enemy.x + candidate.x, y: enemy.y + candidate.y };
        return next.x >= 0 && next.x < GRID_SIZE && next.y >= 0 && next.y < GRID_SIZE;
      });
    const step = choices[Math.floor(Math.random() * choices.length)];
    return { x: enemy.x + step.x, y: enemy.y + step.y };
  });
}

function gameTick() {
  if (!running || paused) return;
  previousSnake = snake.map((segment) => ({ ...segment }));
  previousEnemies = enemies.map((enemy) => ({ ...enemy }));
  direction = nextDirection;
  const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
  if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE || snake.some((segment) => sameCell(segment, head)) || enemies.some((enemy) => sameCell(enemy, head))) {
    explosions = [{ ...head, ttl: 8 }];
    endGame('폭발! 게임 오버 — 재시작해 보세요.');
    return;
  }

  snake.unshift(head);
  if (sameCell(head, food)) {
    score += 10;
    if (score > highScore) {
      highScore = score;
      saveHighScore();
    }
    food = newOpenCell();
  } else {
    snake.pop();
  }

  moveEnemies();
  if (enemies.some((enemy) => sameCell(enemy, head))) {
    explosions = [{ ...head, ttl: 8 }];
    endGame('폭발! 적과 충돌했습니다.');
    return;
  }
  lastStepAt = performance.now();
  explosions = explosions.map((explosion) => ({ ...explosion, ttl: explosion.ttl - 1 })).filter((explosion) => explosion.ttl > 0);
  updateScore();
  draw();
}

function drawCell(cell, color, inset = 1) {
  context.fillStyle = color;
  context.fillRect(cell.x * CELL_SIZE + inset, cell.y * CELL_SIZE + inset, CELL_SIZE - inset * 2, CELL_SIZE - inset * 2);
}

function interpolateCell(previous, current, progress) {
  const start = previous || current;
  return {
    x: start.x + (current.x - start.x) * progress,
    y: start.y + (current.y - start.y) * progress,
  };
}

function draw(progress = 1) {
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < snake.length; index += 1) drawCell(interpolateCell(previousSnake[index], snake[index], progress), index === 0 ? '#145dbf' : '#1877f2', 2);
  drawCell(food, '#e53935', 2);
  enemies.forEach((enemy, index) => drawCell(interpolateCell(previousEnemies[index], enemy, progress), '#59636e', 3));
  explosions.forEach((explosion) => {
    context.fillStyle = '#ff9800';
    context.beginPath();
    context.arc(explosion.x * CELL_SIZE + CELL_SIZE / 2, explosion.y * CELL_SIZE + CELL_SIZE / 2, Math.max(3, explosion.ttl * 1.5), 0, Math.PI * 2);
    context.fill();
  });
}

document.addEventListener('keydown', (event) => {
  if (event.isComposing) return;
  const directionsByCode = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const directionsByKey = { ArrowUp: 'up', w: 'up', W: 'up', ArrowDown: 'down', s: 'down', S: 'down', ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  const directionName = directionsByCode[event.code] || directionsByKey[event.key];
  if (document.activeElement === airplaneCanvas) {
    if (directionName) {
      event.preventDefault();
      airplaneGame.keys.add(directionName);
    } else if (event.code === 'Space') {
      event.preventDefault();
      fireAirplane();
    }
    return;
  }
  if (directionName) {
    event.preventDefault();
    setDirection(directionName);
  } else if (event.code === 'Space') {
    event.preventDefault();
    togglePause();
  }
});

document.addEventListener('keyup', (event) => {
  if (document.activeElement !== airplaneCanvas) return;
  const directionsByCode = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const directionName = directionsByCode[event.code];
  if (directionName) airplaneGame.keys.delete(directionName);
});

touchButtons.forEach((button) => button.addEventListener('click', () => setDirection(button.dataset.direction)));
canvas?.addEventListener('click', () => canvas.focus());
airplaneCanvas?.addEventListener('click', () => airplaneCanvas.focus());
startButton?.addEventListener('click', startGame);
pauseButton?.addEventListener('click', togglePause);
restartButton?.addEventListener('click', startGame);
airplaneStartButton?.addEventListener('click', startAirplaneGame);
airplanePauseButton?.addEventListener('click', toggleAirplanePause);
airplaneRestartButton?.addEventListener('click', startAirplaneGame);

resetGame();
resetAirplaneGame();
updateAirplaneStats();
