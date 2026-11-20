// 「抜け出せない」の各階層。どの階層も画面の中に一つ内側の階層が映っている。
// 座標はすべて 360x640 の論理座標。update の dt はスピード倍率を掛けた「ゲーム内の秒」。

export const W = 360;
export const H = 640;
const SCREEN_RATIO = H / W;

export type Rect = { x: number; y: number; w: number; h: number };
type G = CanvasRenderingContext2D;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const screenRect = (x: number, y: number, w: number): Rect => ({ x, y, w, h: w * SCREEN_RATIO });

function emoji(g: G, ch: string, x: number, y: number, size: number, angle = 0): void {
  g.save();
  g.translate(x, y);
  if (angle) g.rotate(angle);
  g.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(ch, 0, 0);
  g.restore();
}

function label(g: G, text: string, x: number, y: number, size: number, color: string): void {
  g.font = `900 ${size}px system-ui, -apple-system, "Hiragino Sans", sans-serif`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = size / 5;
  g.strokeStyle = "#fff";
  g.strokeText(text, x, y);
  g.fillStyle = color;
  g.fillText(text, x, y);
}

function box(g: G, x: number, y: number, w: number, h: number, r: number, color: string): void {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = color;
  g.fill();
}

export abstract class Layer {
  status: "playing" | "won" | "lost" = "playing";
  /** true の間は自動で遊び続ける（外側の階層の画面に映っている状態） */
  autopilot: boolean;
  abstract readonly id: string;
  abstract readonly instruction: string;
  /** 制限時間（ゲーム内ミリ秒）。null なら時間切れなし */
  readonly timeLimit: number | null = null;

  constructor(autopilot: boolean) {
    this.autopilot = autopilot;
  }

  abstract screen(): Rect;
  abstract update(dt: number): void;
  /** drawScreen() を呼んだ位置に、一つ内側の階層が描かれる */
  abstract draw(g: G, drawScreen: () => void): void;
  tap(_x: number, _y: number): void {}
  timeout(): void {
    this.status = "lost";
  }
}

// ---------------------------------------------------------------- 第1層: ランナー
const GROUND = 500;
const PX = 70;
const PS = 36;
const RUN_SPEED = 260;
const GRAVITY = 2600;
const JUMP_V = 900;

export class Runner extends Layer {
  readonly id = "runner";
  readonly instruction = "タップでジャンプ！";
  private py = 0;
  private vy = 0;
  private obstacles: { x: number; h: number; passed: boolean }[] = [];
  private gap = 300;
  private passed = 0;
  private scroll = 0;

  constructor(autopilot: boolean) {
    super(autopilot);
    this.obstacles.push({ x: W + 20, h: 44, passed: false });
  }

  screen(): Rect {
    return screenRect(196, 96, 132);
  }

  private jump(): void {
    if (this.py === 0) this.vy = JUMP_V;
  }

  tap(): void {
    if (this.status === "playing") this.jump();
  }

  update(dt: number): void {
    if (this.status === "lost") return;
    this.scroll = (this.scroll + RUN_SPEED * dt) % 40;

    this.vy -= GRAVITY * dt;
    this.py = Math.max(0, this.py + this.vy * dt);
    if (this.py === 0) this.vy = 0;

    for (const o of this.obstacles) o.x -= RUN_SPEED * dt;
    this.obstacles = this.obstacles.filter((o) => o.x > -40);
    const lastX = this.obstacles.at(-1)?.x ?? 0;
    if (lastX < W + 20 - this.gap) {
      this.obstacles.push({ x: W + 20, h: rand(36, 60), passed: false });
      this.gap = RUN_SPEED * rand(0.95, 1.4) + 40;
    }

    for (const o of this.obstacles) {
      const ahead = o.x - (PX + PS);
      if (this.autopilot && ahead > 20 && ahead < 60) this.jump();

      const hitX = o.x + 4 < PX + PS - 4 && o.x + 26 - 4 > PX + 4;
      const hitY = this.py < o.h - 4;
      if (hitX && hitY && !this.autopilot) {
        this.status = "lost";
        return;
      }
      if (!o.passed && o.x + 26 < PX) {
        o.passed = true;
        this.passed++;
        if (this.passed >= 3 && !this.autopilot) this.status = "won";
      }
    }
  }

  draw(g: G, drawScreen: () => void): void {
    const sky = g.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, "#7cc8ff");
    sky.addColorStop(1, "#dff4ff");
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    g.beginPath();
    g.arc(60, 90, 30, 0, Math.PI * 2);
    g.fillStyle = "#ffe066";
    g.fill();

    // 看板（中に一つ内側の階層が映る）
    const s = this.screen();
    g.fillStyle = "#555";
    g.fillRect(s.x + s.w / 2 - 7, s.y + s.h, 14, GROUND - s.y - s.h);
    box(g, s.x - 8, s.y - 8, s.w + 16, s.h + 16, 8, "#333");
    drawScreen();

    g.fillStyle = "#5cbf5c";
    g.fillRect(0, GROUND, W, 12);
    g.fillStyle = "#b9824d";
    g.fillRect(0, GROUND + 12, W, H - GROUND - 12);
    g.fillStyle = "#a06e3e";
    for (let x = -this.scroll; x < W; x += 40) g.fillRect(x, GROUND + 30, 20, 6);

    for (const o of this.obstacles) box(g, o.x, GROUND - o.h, 26, o.h, 6, "#2f8a3a");

    const top = GROUND - PS - this.py;
    const lost = this.status === "lost";
    box(g, PX, top, PS, PS, 8, lost ? "#999" : "#ff5a5a");
    g.fillStyle = "#fff";
    g.fillRect(PX + 18, top + 9, 9, 11);
    g.fillRect(PX + 28, top + 9, 7, 11);
    if (lost) label(g, "×", PX + 26, top + 14, 16, "#222");
    else {
      g.fillStyle = "#222";
      g.fillRect(PX + 22, top + 12, 4, 6);
      g.fillRect(PX + 30, top + 12, 4, 6);
    }
  }
}

// ---------------------------------------------------------------- 第2層: ママが来たら隠せ
const DOOR = { x: 16, y: 120, w: 84, h: 190 };
const REACT = 0.7;

export class Mom extends Layer {
  readonly id = "mom";
  readonly instruction = "ママが来たら隠せ！";
  private phase: "wait" | "peek" | "hidden" | "caught" | "early" = "wait";
  private t = 0;
  private phaseT = 0;
  private appearAt = rand(1.2, 2.6);
  private feintAt: number | null = Math.random() < 0.6 ? rand(0.5, this.appearAt - 0.5) : null;
  private hide = 0;

  screen(): Rect {
    const r = screenRect(120, 250, 150);
    r.y += this.hide * 420;
    return r;
  }

  private setPhase(p: Mom["phase"]): void {
    this.phase = p;
    this.phaseT = 0;
  }

  tap(): void {
    if (this.status !== "playing") return;
    if (this.phase === "wait") {
      this.setPhase("early");
      this.status = "lost";
    } else if (this.phase === "peek") {
      this.setPhase("hidden");
      this.status = "won";
    }
  }

  update(dt: number): void {
    this.t += dt;
    this.phaseT += dt;
    const hiding = this.phase === "hidden" || this.phase === "early";
    this.hide = Math.max(0, Math.min(1, this.hide + (hiding ? 6 : -3) * dt));
    if (this.status === "lost") return;

    if (this.phase === "wait" && this.t >= this.appearAt) this.setPhase("peek");
    else if (this.phase === "peek") {
      if (this.autopilot && this.phaseT > 0.25) this.setPhase("hidden");
      else if (!this.autopilot && this.phaseT > REACT) {
        this.setPhase("caught");
        this.status = "lost";
      }
    } else if (this.phase === "hidden" && this.autopilot && this.phaseT > 1.4) {
      // ママが去ったらまた遊び始める
      this.setPhase("wait");
      this.t = 0;
      this.appearAt = rand(1.6, 3.2);
      this.feintAt = Math.random() < 0.5 ? rand(0.6, this.appearAt - 0.5) : null;
    }
  }

  private momVisible(): boolean {
    return this.phase === "peek" || this.phase === "caught" || (this.phase === "hidden" && this.phaseT < 1);
  }

  draw(g: G, drawScreen: () => void): void {
    g.fillStyle = "#f6e3c6";
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#caa07a";
    g.fillRect(0, 470, W, H - 470);
    box(g, 250, 70, 70, 90, 4, "#8ecae6");
    emoji(g, "🦖", 285, 115, 40);

    // ドア
    const shaking = this.phase === "wait" && this.feintAt !== null && this.t > this.feintAt && this.t < this.feintAt + 0.4;
    const dx = shaking ? Math.sin(this.t * 80) * 3 : 0;
    box(g, DOOR.x - 6, DOOR.y - 6, DOOR.w + 12, DOOR.h + 6, 4, "#7a4a24");
    if (this.momVisible()) {
      g.fillStyle = "#3b2a1e";
      g.fillRect(DOOR.x, DOOR.y, DOOR.w, DOOR.h);
      emoji(g, this.phase === "caught" ? "😡" : "👩", DOOR.x + DOOR.w / 2, DOOR.y + 70, 60);
      if (this.phase === "caught") label(g, "こらー！", DOOR.x + 70, DOOR.y - 24, 28, "#e33");
      if (this.phase === "hidden") label(g, "…？", DOOR.x + 64, DOOR.y - 20, 24, "#333");
    } else {
      box(g, DOOR.x + dx, DOOR.y, DOOR.w, DOOR.h, 2, "#a0673a");
      g.beginPath();
      g.arc(DOOR.x + DOOR.w - 14 + dx, DOOR.y + 100, 6, 0, Math.PI * 2);
      g.fillStyle = "#f2c94c";
      g.fill();
      if (shaking) label(g, "ガタッ", DOOR.x + 60, DOOR.y - 20, 26, "#333");
    }

    // 子ども
    const face = this.phase === "caught" ? "😱" : this.phase === "early" ? "😰" : this.hide > 0.5 ? "😇" : "😆";
    emoji(g, face, 195, 205, 96);
    if (this.phase === "hidden") label(g, "♪", 262, 170, 30, "#555");
    if (this.phase === "early") label(g, "まだ来てない！", W / 2, 120, 26, "#e33");

    // 携帯ゲーム機
    const s = this.screen();
    if (s.y < H) {
      box(g, s.x - 14, s.y - 20, s.w + 28, s.h + 110, 22, "#7a5cff");
      drawScreen();
      const by = s.y + s.h + 52;
      g.fillStyle = "#3d2c99";
      g.fillRect(s.x + 14, by - 6, 36, 12);
      g.fillRect(s.x + 26, by - 18, 12, 36);
      g.beginPath();
      g.arc(s.x + s.w - 34, by + 6, 11, 0, Math.PI * 2);
      g.arc(s.x + s.w - 8, by - 10, 11, 0, Math.PI * 2);
      g.fillStyle = "#ff6b9a";
      g.fill();
      g.fillStyle = "#ffcfa8";
      g.beginPath();
      g.arc(s.x - 16, s.y + s.h * 0.75, 20, 0, Math.PI * 2);
      g.arc(s.x + s.w + 16, s.y + s.h * 0.75, 20, 0, Math.PI * 2);
      g.fill();
    }
  }
}

// ---------------------------------------------------------------- 第3層: 連打で充電しろ
const DRAIN = 16;
const CHARGE = 8;

export class Battery extends Layer {
  readonly id = "battery";
  readonly instruction = "連打で充電しろ！";
  private level = 30;
  private flash = 0;
  private charging = false;
  private autoCd = 0;
  private t = 0;

  screen(): Rect {
    return screenRect(100, 150, 160);
  }

  private charge(): void {
    this.level = Math.min(100, this.level + CHARGE);
    this.flash = 1;
    if (!this.autopilot && this.level >= 100) this.status = "won";
  }

  tap(): void {
    if (this.status === "playing") this.charge();
  }

  update(dt: number): void {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 5);
    if (this.status === "lost") return;
    this.level -= DRAIN * dt;

    if (this.autopilot) {
      if (this.level < 35) this.charging = true;
      if (this.level > 92) this.charging = false;
      this.autoCd -= dt;
      if (this.charging && this.autoCd <= 0) {
        this.charge();
        this.autoCd = rand(0.1, 0.2);
      }
    } else if (this.level <= 0) {
      this.level = 0;
      this.status = "lost";
    }
  }

  draw(g: G, drawScreen: () => void): void {
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#141a38");
    bg.addColorStop(1, "#2e3a73");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    g.fillStyle = "#fff";
    for (const [x, y] of [[300, 40], [330, 120], [40, 150], [280, 200], [320, 300]]) g.fillRect(x, y, 3, 3);
    emoji(g, "🌙", 50, 70, 40);

    // バッテリー表示
    const lv = Math.max(0, this.level);
    const color = lv < 20 ? "#ff4d4d" : lv < 50 ? "#ffcc33" : "#4cd964";
    g.lineWidth = 4;
    g.strokeStyle = "#fff";
    g.beginPath();
    g.roundRect(125, 62, 104, 40, 8);
    g.stroke();
    g.fillStyle = "#fff";
    g.fillRect(231, 74, 8, 16);
    box(g, 131, 68, 92 * (lv / 100), 28, 4, color);
    label(g, `${Math.round(lv)}%`, 177, 82, 18, "#222");
    if (this.flash > 0) emoji(g, "⚡", 262, 82, 34 + this.flash * 12);

    // スマホ
    const s = this.screen();
    g.strokeStyle = "#ddd";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(s.x + s.w / 2, s.y + s.h + 18);
    g.quadraticCurveTo(s.x + s.w / 2 + 60, 560, s.x + s.w / 2 + 120, H + 10);
    g.stroke();
    box(g, s.x - 10, s.y - 18, s.w + 20, s.h + 36, 24, "#111");
    drawScreen();
    // 電池が減るほど中の画面が暗くなる
    g.fillStyle = `rgba(0,0,0,${(1 - lv / 100) * 0.85})`;
    g.fillRect(s.x, s.y, s.w, s.h);
    if (this.status === "lost") emoji(g, "🪫", s.x + s.w / 2, s.y + s.h / 2, 60);
    box(g, s.x + s.w / 2 - 28, s.y - 12, 56, 8, 4, "#000");
    if (this.flash > 0) {
      g.fillStyle = `rgba(255,240,120,${this.flash})`;
      g.fillRect(s.x + s.w / 2 - 12, s.y + s.h + 12, 24, 12);
    }

    // 寝ている人
    const face = this.status === "lost" ? "😱" : lv < 25 ? "😰" : "😳";
    emoji(g, face, W / 2, 520, 76);
    box(g, -20, 556, W + 40, 120, 40, "#5b6bb5");
    g.fillStyle = "#ffcfa8";
    g.beginPath();
    g.arc(s.x - 6, s.y + s.h - 30, 22, 0, Math.PI * 2);
    g.arc(s.x + s.w + 6, s.y + s.h - 30, 22, 0, Math.PI * 2);
    g.fill();
  }
}

// ---------------------------------------------------------------- 第4層: バグをつぶせ
const BUG_AREA = { x: 70, y: 90, w: 220, h: 400 };
type Bug = { x: number; y: number; vx: number; vy: number };

export class Dev extends Layer {
  readonly id = "dev";
  readonly instruction = "バグを3匹つぶせ！";
  readonly timeLimit = 4500;
  private bugs: Bug[] = [];
  private splats: { x: number; y: number; a: number }[] = [];
  private killed = 0;
  private autoCd = 1.5;
  private t = 0;

  constructor(autopilot: boolean) {
    super(autopilot);
    for (let i = 0; i < 4; i++) this.spawn();
  }

  screen(): Rect {
    return screenRect(72, 90, 216);
  }

  private spawn(): void {
    const a = rand(0, Math.PI * 2);
    this.bugs.push({
      x: rand(BUG_AREA.x, BUG_AREA.x + BUG_AREA.w),
      y: rand(BUG_AREA.y, BUG_AREA.y + BUG_AREA.h),
      vx: Math.cos(a) * 70,
      vy: Math.sin(a) * 70,
    });
  }

  private squash(bug: Bug): void {
    this.bugs = this.bugs.filter((b) => b !== bug);
    this.splats.push({ x: bug.x, y: bug.y, a: 1 });
    this.spawn();
  }

  tap(x: number, y: number): void {
    if (this.status !== "playing") return;
    let best: Bug | null = null;
    let bestD = 38;
    for (const b of this.bugs) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bestD) {
        best = b;
        bestD = d;
      }
    }
    if (!best) return;
    this.squash(best);
    this.killed++;
    if (this.killed >= 3 && !this.autopilot) this.status = "won";
  }

  update(dt: number): void {
    this.t += dt;
    for (const s of this.splats) s.a -= dt * 0.6;
    this.splats = this.splats.filter((s) => s.a > 0);
    if (this.status === "lost") return;

    for (const b of this.bugs) {
      // ふらふら向きを変えながら這う
      const turn = Math.sin(this.t * 3 + b.x) * 2 * dt;
      [b.vx, b.vy] = [b.vx * Math.cos(turn) - b.vy * Math.sin(turn), b.vx * Math.sin(turn) + b.vy * Math.cos(turn)];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < BUG_AREA.x || b.x > BUG_AREA.x + BUG_AREA.w) b.vx *= -1;
      if (b.y < BUG_AREA.y || b.y > BUG_AREA.y + BUG_AREA.h) b.vy *= -1;
    }

    if (this.autopilot) {
      this.autoCd -= dt;
      if (this.autoCd <= 0) {
        this.squash(this.bugs[Math.floor(Math.random() * this.bugs.length)]);
        this.autoCd = rand(1, 2.2);
      }
    }
  }

  draw(g: G, drawScreen: () => void): void {
    g.fillStyle = "#e3e8ef";
    g.fillRect(0, 0, W, H);
    box(g, 300, 120, 54, 54, 2, "#ffe36e");
    g.fillStyle = "#333";
    g.font = `bold 13px system-ui, "Hiragino Sans", sans-serif`;
    g.textAlign = "center";
    g.fillText("締切", 327, 139);
    g.fillText("今日", 327, 159);

    g.fillStyle = "#8a6a4c";
    g.fillRect(0, 520, W, H - 520);
    const s = this.screen();
    g.fillStyle = "#333";
    g.fillRect(W / 2 - 15, s.y + s.h, 30, 520 - s.y - s.h);
    box(g, W / 2 - 50, 512, 100, 12, 6, "#333");
    box(g, s.x - 10, s.y - 10, s.w + 20, s.h + 20, 10, "#222");
    drawScreen();

    for (const sp of this.splats) {
      g.fillStyle = `rgba(120,200,60,${sp.a})`;
      g.beginPath();
      g.ellipse(sp.x, sp.y, 16, 11, 0.4, 0, Math.PI * 2);
      g.fill();
    }
    for (const b of this.bugs) emoji(g, "🐛", b.x, b.y, 32, Math.atan2(b.vy, b.vx) + Math.PI);

    box(g, 80, 560, 200, 34, 6, "#d9d9d9");
    emoji(g, "☕", 316, 570, 40);
    g.fillStyle = "#2b2b2b";
    g.beginPath();
    g.arc(70, 660, 72, 0, Math.PI * 2);
    g.fill();
    if (this.status === "lost") label(g, "バグだらけ…", W / 2, 280, 34, "#e33");
  }
}

/** この順に外側へ出ていき、最後の外側は最初の階層の画面の中に戻る */
export const LAYERS = [Runner, Mom, Battery, Dev];
