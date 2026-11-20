import "./style.css";
import { track } from "../analytics";
import { onTap } from "../util";
import { H, LAYERS, Layer, W } from "./layers";

const LIVES = 3;
const SPEED_RATE = 1.18;
const ZOOM_MS = 1100;
const FAIL_MS = 800;
const SITE_URL = "https://yamasinagames.github.io/weekly-games/loop/";
const BEST_KEY = "weekly-games:loop:best";
const N = LAYERS.length;

const $ = (id: string) => document.getElementById(id)!;
const frameEl = $("frame");
const canvas = $("canvas") as HTMLCanvasElement;
const g = canvas.getContext("2d")!;
const livesEl = $("lives");
const scoreEl = $("score");
const timerEl = $("timer");
const timerBar = $("timerBar");
const instructionEl = $("instruction");
const markEl = $("mark");
const resultEl = $("result");

// 画面に映るだけの階層（種類ごとに1つ、ずっと自動で遊んでいる）
const idle: Layer[] = LAYERS.map((L) => new L(true));
let type = 0;
let play: Layer = new LAYERS[0](false);
let phase: "play" | "zoom" | "fail" | "over" = "play";
let phaseMs = 0;
let timeLeft = 0;
let cleared = 0;
let loop = 1;
let lives = LIVES;
let speed = 1;
let started = false;

function loadBest(): number {
  try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; }
}

function saveBest(n: number): void {
  try { localStorage.setItem(BEST_KEY, String(n)); } catch {}
}

function renderHud(): void {
  livesEl.textContent = "❤️".repeat(lives) + "🤍".repeat(LIVES - lives);
  scoreEl.textContent = `脱出 ${cleared}`;
}

function showInstruction(main: string, sub = "", persist = false): void {
  instructionEl.replaceChildren();
  if (sub) {
    const s = document.createElement("small");
    s.textContent = sub;
    instructionEl.append(s);
  }
  instructionEl.append(main);
  instructionEl.className = "instruction";
  void instructionEl.offsetWidth;
  instructionEl.classList.add(persist ? "stay" : "show");
}

function startPlay(): void {
  phase = "play";
  phaseMs = 0;
  timeLeft = play.timeLimit ? play.timeLimit / speed : 0;
  timerEl.classList.toggle("off", !play.timeLimit);
  timerBar.style.width = "100%";
}

function clearLayer(): void {
  cleared++;
  track(`clear-${play.id}`);
  play.autopilot = true;
  idle[type] = play;

  type = (type + 1) % N;
  let sub = "";
  if (type === 0) {
    loop++;
    speed = Math.pow(SPEED_RATE, loop - 1);
    sub = `LOOP ${loop} …まだ抜け出せない`;
    track(`loop-${loop}`);
  }
  play = new LAYERS[type](false);
  phase = "zoom";
  phaseMs = 0;
  timerEl.classList.add("off");
  renderHud();
  showInstruction(play.instruction, sub);
}

function failLayer(): void {
  lives--;
  track(`fail-${play.id}`);
  navigator.vibrate?.(80);
  phase = "fail";
  phaseMs = 0;
  markEl.classList.remove("hidden");
  renderHud();
}

function afterFail(): void {
  markEl.classList.add("hidden");
  if (lives === 0) return gameOver();
  play = new LAYERS[type](false);
  startPlay();
  showInstruction(play.instruction);
}

function gameOver(): void {
  phase = "over";
  const best = loadBest();
  const isBest = cleared > best;
  if (isBest) saveBest(cleared);
  track("game-over");
  track(`reached-${cleared}`);
  $("resultScore").textContent = String(cleared);
  $("resultSub").textContent = isBest ? "自己ベスト更新！" : `自己ベスト ${best}`;
  resultEl.classList.remove("hidden");
}

function restart(): void {
  track("retry");
  resultEl.classList.add("hidden");
  type = 0;
  cleared = 0;
  loop = 1;
  lives = LIVES;
  speed = 1;
  play = new LAYERS[0](false);
  renderHud();
  startPlay();
  showInstruction(play.instruction);
}

function share(): void {
  track("share");
  const text = `ゲームの中のゲームの中のゲームから${cleared}回抜け出した。\nでも、まだ抜け出せない。\n#週刊ゲーム`;
  const url = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE_URL)}`;
  window.open(url, "_blank");
}

// ---------------------------------------------------------------- 描画
function drawLayer(layer: Layer, t: number, depth: number): void {
  layer.draw(g, () => {
    const s = layer.screen();
    g.save();
    g.beginPath();
    g.rect(s.x, s.y, s.w, s.h);
    g.clip();
    // 小さすぎて見えない深さまで来たら打ち切る
    if (depth > 7 || g.getTransform().a * s.w < 3) {
      g.fillStyle = "#222";
      g.fillRect(s.x, s.y, s.w, s.h);
    } else {
      g.translate(s.x, s.y);
      g.scale(s.w / W, s.h / H);
      const inner = (t + N - 1) % N;
      drawLayer(idle[inner], inner, depth + 1);
    }
    g.restore();
  });
}

function render(): void {
  const k = canvas.width / W;
  g.setTransform(k, 0, 0, k, 0, 0);
  if (phase === "zoom") {
    // 新しい階層の画面いっぱいの状態から、全体が見えるまでズームアウト
    const p = 1 - Math.pow(1 - Math.min(1, phaseMs / ZOOM_MS), 3);
    const s = play.screen();
    const w = s.w * Math.pow(W / s.w, p);
    const f = (w - s.w) / (W - s.w);
    const x = s.x * (1 - f);
    const y = s.y * (1 - f);
    g.scale(W / w, W / w);
    g.translate(-x, -y);
  }
  drawLayer(play, type, 0);
}

function resize(): void {
  const cssW = Math.min(innerWidth, (innerHeight * W) / H);
  const cssH = (cssW * H) / W;
  frameEl.style.width = `${cssW}px`;
  frameEl.style.height = `${cssH}px`;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
}

// ---------------------------------------------------------------- ループ
let last = performance.now();
function frame(now: number): void {
  const dtMs = Math.min(50, now - last);
  last = now;
  const dt = (dtMs / 1000) * speed;
  phaseMs += dtMs;

  for (const l of idle) l.update(dt);

  if (phase === "play" && started) {
    play.update(dt);
    if (play.timeLimit && play.status === "playing") {
      timeLeft -= dtMs;
      timerBar.style.width = `${Math.max(0, timeLeft / (play.timeLimit / speed)) * 100}%`;
      if (timeLeft <= 0) play.timeout();
    }
    if (play.status === "won") clearLayer();
    else if (play.status === "lost") failLayer();
  } else if (phase === "zoom" && phaseMs >= ZOOM_MS) startPlay();
  else if (phase === "fail") {
    play.update(dt);
    if (phaseMs >= FAIL_MS) afterFail();
  }

  render();
  requestAnimationFrame(frame);
}

canvas.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  if (!started) {
    started = true;
    track("first-tap");
    instructionEl.className = "instruction";
  }
  if (phase !== "play") return;
  const r = canvas.getBoundingClientRect();
  play.tap(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
});

setTimeout(() => {
  if (!started) track("no-tap-3s");
}, 3000);

// 開発中だけ、コンソールから __loop.win() で今の階層をクリア扱いにできる
if (import.meta.env.DEV) {
  Object.assign(window, { __loop: { win: () => (play.status = "won"), lose: () => (play.status = "lost") } });
}

addEventListener("resize", resize);
onTap($("shareBtn"), share);
onTap($("retryBtn"), restart);
track("open");
resize();
renderHud();
startPlay();
showInstruction(play.instruction, "ここから抜け出せ", true);
requestAnimationFrame(frame);
