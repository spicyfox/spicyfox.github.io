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
  updateScore();
  draw();
}

function startGame() {
  if (timerId !== null) clearInterval(timerId);
  resetGame();
  running = true;
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
  explosions = explosions.map((explosion) => ({ ...explosion, ttl: explosion.ttl - 1 })).filter((explosion) => explosion.ttl > 0);
  updateScore();
  draw();
}

function drawCell(cell, color, inset = 1) {
  context.fillStyle = color;
  context.fillRect(cell.x * CELL_SIZE + inset, cell.y * CELL_SIZE + inset, CELL_SIZE - inset * 2, CELL_SIZE - inset * 2);
}

function draw() {
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#f8fbff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < snake.length; index += 1) drawCell(snake[index], index === 0 ? '#145dbf' : '#1877f2', 2);
  drawCell(food, '#e53935', 2);
  enemies.forEach((enemy) => drawCell(enemy, '#59636e', 3));
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
  if (directionName) {
    event.preventDefault();
    setDirection(directionName);
  } else if (event.code === 'Space') {
    event.preventDefault();
    togglePause();
  }
});

touchButtons.forEach((button) => button.addEventListener('click', () => setDirection(button.dataset.direction)));
startButton?.addEventListener('click', startGame);
pauseButton?.addEventListener('click', togglePause);
restartButton?.addEventListener('click', startGame);

resetGame();
