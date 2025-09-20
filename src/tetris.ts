import { PIECE_TYPES, PieceType, TETROMINO_SHAPES, getKickData } from './tetromino';

type BoardCell = PieceType | null;

type GameState = 'playing' | 'paused' | 'over';

interface ActivePiece {
  type: PieceType;
  rotation: number;
  x: number;
  y: number;
}

export interface GameStats {
  score: number;
  level: number;
  lines: number;
  combo: number;
  backToBack: number;
  state: GameState;
}

const COLS = 10;
const VISIBLE_ROWS = 20;
const TOTAL_ROWS = 22; // includes two hidden rows
const HIDDEN_ROWS = TOTAL_ROWS - VISIBLE_ROWS;
const LOCK_DELAY_MS = 500;
const SOFT_DROP_INTERVAL = 50;
const LINE_SCORES = [0, 100, 300, 500, 800];

const SPAWN_POSITIONS: Record<PieceType, { x: number; y: number }> = {
  I: { x: 3, y: -2 },
  O: { x: 3, y: -1 },
  T: { x: 3, y: -1 },
  S: { x: 3, y: -1 },
  Z: { x: 3, y: -1 },
  J: { x: 3, y: -1 },
  L: { x: 3, y: -1 }
};

const createBoard = (): BoardCell[][] =>
  Array.from({ length: TOTAL_ROWS }, () => Array<BoardCell>(COLS).fill(null));

const shuffle = <T>(values: T[]): T[] => {
  for (let i = values.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
};

export class TetrisGame {
  private board: BoardCell[][] = createBoard();

  private queue: PieceType[] = [];

  private active: ActivePiece | null = null;

  private holdPiece: PieceType | null = null;

  private canHold = true;

  private gravityTimer = 0;

  private gravityInterval = 1000;

  private lockTimer = 0;

  private grounded = false;

  private softDropActive = false;

  private state: GameState = 'playing';

  private score = 0;

  private level = 1;

  private lines = 0;

  private combo = -1;

  private backToBack = 0;

  constructor() {
    this.reset();
  }

  public reset(): void {
    this.board = createBoard();
    this.queue = [];
    this.active = null;
    this.holdPiece = null;
    this.canHold = true;
    this.gravityTimer = 0;
    this.gravityInterval = 1000;
    this.lockTimer = 0;
    this.grounded = false;
    this.softDropActive = false;
    this.state = 'playing';
    this.score = 0;
    this.level = 1;
    this.lines = 0;
    this.combo = -1;
    this.backToBack = 0;
    this.refillQueue();
    this.spawnNextPiece();
  }

  public update(delta: number): void {
    if (this.state !== 'playing' || !this.active) {
      return;
    }

    const interval = this.softDropActive ? SOFT_DROP_INTERVAL : this.gravityInterval;
    this.gravityTimer += delta;

    while (this.gravityTimer >= interval && this.active) {
      this.gravityTimer -= interval;
      const moved = this.tryMove(0, 1);
      if (moved) {
        if (this.softDropActive) {
          this.score += 1;
        }
      } else {
        this.grounded = true;
        break;
      }
    }

    if (this.grounded && this.active) {
      this.lockTimer += delta;
      if (this.lockTimer >= LOCK_DELAY_MS) {
        this.lockPiece();
      }
    }
  }

  public move(direction: -1 | 1): void {
    if (this.state !== 'playing') {
      return;
    }
    const moved = this.tryMove(direction, 0);
    if (moved) {
      this.grounded = this.checkGrounded();
    }
  }

  public rotate(clockwise: boolean): void {
    if (this.state !== 'playing' || !this.active) {
      return;
    }

    const dir = clockwise ? 1 : -1;
    const fromRotation = ((this.active.rotation % 4) + 4) % 4;
    const toRotation = ((fromRotation + dir + 4) % 4) as number;
    const kicks = getKickData(this.active.type, fromRotation as any, toRotation as any);

    for (const [offsetX, offsetY] of kicks) {
      const newX = this.active.x + offsetX;
      const newY = this.active.y + offsetY;
      if (!this.collides(this.active.type, newX, newY, toRotation)) {
        this.active.rotation = toRotation;
        this.active.x = newX;
        this.active.y = newY;
        this.grounded = this.checkGrounded();
        this.lockTimer = 0;
        return;
      }
    }
  }

  public hardDrop(): void {
    if (this.state !== 'playing' || !this.active) {
      return;
    }
    const distance = this.getDropDistance();
    if (distance <= 0) {
      return;
    }
    this.active.y += distance;
    this.score += distance * 2;
    this.lockPiece();
  }

  public tapSoftDrop(): void {
    if (this.state !== 'playing') {
      return;
    }
    const moved = this.tryMove(0, 1);
    if (moved) {
      this.score += 1;
    } else {
      this.grounded = true;
    }
  }

  public setSoftDrop(active: boolean): void {
    if (this.softDropActive === active) {
      return;
    }
    this.softDropActive = active;
    if (active) {
      this.gravityTimer = 0;
    }
  }

  public hold(): void {
    if (this.state !== 'playing' || !this.active || !this.canHold) {
      return;
    }

    const currentType = this.active.type;
    const swappedType = this.holdPiece;
    this.holdPiece = currentType;
    this.canHold = false;

    if (swappedType) {
      this.active = this.createPiece(swappedType);
      if (this.collides(this.active.type, this.active.x, this.active.y, this.active.rotation)) {
        this.endGame();
        return;
      }
      this.grounded = this.checkGrounded();
      this.lockTimer = 0;
      this.softDropActive = false;
      this.gravityTimer = 0;
    } else {
      this.active = null;
      this.spawnNextPiece();
    }
  }

  public togglePause(): void {
    if (this.state === 'playing') {
      this.state = 'paused';
      this.softDropActive = false;
    } else if (this.state === 'paused') {
      this.state = 'playing';
    }
  }

  public getBoard(): readonly BoardCell[][] {
    return this.board;
  }

  public getActiveCells(): Array<{ x: number; y: number; type: PieceType }> {
    if (!this.active) {
      return [];
    }
    return this.getCellsFor(this.active.type, this.active.rotation, this.active.x, this.active.y);
  }

  public getGhostCells(): Array<{ x: number; y: number; type: PieceType }> {
    if (!this.active) {
      return [];
    }
    const drop = this.getDropDistance();
    return this.getCellsFor(this.active.type, this.active.rotation, this.active.x, this.active.y + drop);
  }

  public getNextPieces(count = 5): PieceType[] {
    return this.queue.slice(0, count);
  }

  public getHold(): PieceType | null {
    return this.holdPiece;
  }

  public getStats(): GameStats {
    return {
      score: this.score,
      level: this.level,
      lines: this.lines,
      combo: this.combo,
      backToBack: this.backToBack,
      state: this.state
    };
  }

  public isGameOver(): boolean {
    return this.state === 'over';
  }

  private tryMove(dx: number, dy: number): boolean {
    if (!this.active) {
      return false;
    }
    const newX = this.active.x + dx;
    const newY = this.active.y + dy;
    if (this.collides(this.active.type, newX, newY, this.active.rotation)) {
      if (dy > 0) {
        this.grounded = true;
      }
      return false;
    }
    this.active.x = newX;
    this.active.y = newY;
    this.lockTimer = 0;
    this.grounded = this.checkGrounded();
    return true;
  }

  private getDropDistance(): number {
    if (!this.active) {
      return 0;
    }
    let distance = 0;
    while (!this.collides(this.active.type, this.active.x, this.active.y + distance + 1, this.active.rotation)) {
      distance += 1;
    }
    return distance;
  }

  private lockPiece(): void {
    if (!this.active) {
      return;
    }
    const matrix = this.getMatrix(this.active.type, this.active.rotation);
    let toppedOut = false;

    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix[row].length; col += 1) {
        if (!matrix[row][col]) {
          continue;
        }
        const boardX = this.active.x + col;
        const boardY = this.active.y + row;
        if (boardY < 0) {
          toppedOut = true;
          continue;
        }
        if (boardY >= TOTAL_ROWS || boardX < 0 || boardX >= COLS) {
          continue;
        }
        this.board[boardY][boardX] = this.active.type;
      }
    }

    if (toppedOut) {
      this.endGame();
      return;
    }

    const cleared = this.clearLines();
    this.handleLineScoring(cleared);
    this.active = null;
    this.grounded = false;
    this.lockTimer = 0;
    this.softDropActive = false;
    this.gravityTimer = 0;

    if (this.state === 'playing') {
      this.spawnNextPiece();
    }
  }

  private clearLines(): number {
    let cleared = 0;
    for (let row = TOTAL_ROWS - 1; row >= 0; row -= 1) {
      if (this.board[row].every((cell) => cell !== null)) {
        this.board.splice(row, 1);
        this.board.unshift(Array<BoardCell>(COLS).fill(null));
        cleared += 1;
        row += 1; // stay on same index after unshift
      }
    }
    return cleared;
  }

  private handleLineScoring(linesCleared: number): void {
    if (linesCleared > 0) {
      this.lines += linesCleared;
      const levelMultiplier = this.level;
      const baseScore = LINE_SCORES[linesCleared] ?? 0;
      const isTetris = linesCleared === 4;

      let lineScore = baseScore * levelMultiplier;
      if (isTetris && this.backToBack > 0) {
        lineScore = Math.floor(lineScore * 1.5);
      }

      this.score += lineScore;

      this.combo = this.combo >= 0 ? this.combo + 1 : 0;
      if (this.combo > 0) {
        this.score += 50 * this.combo * levelMultiplier;
      }

      this.backToBack = isTetris ? this.backToBack + 1 : 0;
    } else {
      this.combo = -1;
      if (this.backToBack > 0) {
        this.backToBack = 0;
      }
    }

    this.level = Math.floor(this.lines / 10) + 1;
    this.gravityInterval = this.computeGravityInterval();
  }

  private spawnNextPiece(): void {
    this.refillQueue();
    const nextType = this.queue.shift();
    if (!nextType) {
      return;
    }
    this.active = this.createPiece(nextType);
    this.canHold = true;
    this.grounded = this.checkGrounded();
    this.lockTimer = 0;
    this.softDropActive = false;
    this.gravityTimer = 0;

    if (this.collides(this.active.type, this.active.x, this.active.y, this.active.rotation)) {
      this.endGame();
    }
  }

  private createPiece(type: PieceType): ActivePiece {
    const spawn = SPAWN_POSITIONS[type];
    return {
      type,
      rotation: 0,
      x: spawn.x,
      y: spawn.y
    };
  }

  private computeGravityInterval(): number {
    const levelIndex = Math.max(0, this.level - 1);
    const speed = Math.max(0.1, 0.8 - levelIndex * 0.007);
    return Math.max(50, Math.pow(speed, levelIndex) * 1000);
  }

  private getMatrix(type: PieceType, rotation: number) {
    const states = TETROMINO_SHAPES[type];
    const index = rotation % states.length;
    return states[index];
  }

  private getCellsFor(type: PieceType, rotation: number, baseX: number, baseY: number) {
    const matrix = this.getMatrix(type, rotation);
    const cells: Array<{ x: number; y: number; type: PieceType }> = [];
    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix[row].length; col += 1) {
        if (!matrix[row][col]) {
          continue;
        }
        const x = baseX + col;
        const y = baseY + row;
        cells.push({ x, y, type });
      }
    }
    return cells;
  }

  private collides(type: PieceType, x: number, y: number, rotation: number): boolean {
    const matrix = this.getMatrix(type, rotation);
    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix[row].length; col += 1) {
        if (!matrix[row][col]) {
          continue;
        }
        const boardX = x + col;
        const boardY = y + row;
        if (boardX < 0 || boardX >= COLS || boardY >= TOTAL_ROWS) {
          return true;
        }
        if (boardY >= 0 && this.board[boardY][boardX]) {
          return true;
        }
      }
    }
    return false;
  }

  private checkGrounded(): boolean {
    if (!this.active) {
      return false;
    }
    return this.collides(this.active.type, this.active.x, this.active.y + 1, this.active.rotation);
  }

  private refillQueue(): void {
    while (this.queue.length < 7) {
      const bag = shuffle([...PIECE_TYPES]);
      this.queue.push(...bag);
    }
  }

  private endGame(): void {
    this.state = 'over';
    this.active = null;
    this.softDropActive = false;
  }
}

export { COLS, VISIBLE_ROWS, TOTAL_ROWS, HIDDEN_ROWS };
