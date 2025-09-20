import { TetrisGame, GameStats, COLS, VISIBLE_ROWS, HIDDEN_ROWS } from './tetris';
import { GHOST_ALPHA, PIECE_COLORS, PieceType, TETROMINO_SHAPES } from './tetromino';

interface RendererElements {
  board: HTMLCanvasElement;
  next: HTMLCanvasElement;
  hold: HTMLCanvasElement;
  score: HTMLElement;
  level: HTMLElement;
  lines: HTMLElement;
  combo: HTMLElement;
  backToBack: HTMLElement;
  overlay: HTMLElement;
}

export class TetrisRenderer {
  private boardCtx: CanvasRenderingContext2D;

  private nextCtx: CanvasRenderingContext2D;

  private holdCtx: CanvasRenderingContext2D;

  private readonly boardCellSize: number;

  constructor(private readonly elements: RendererElements) {
    const boardContext = elements.board.getContext('2d');
    const nextContext = elements.next.getContext('2d');
    const holdContext = elements.hold.getContext('2d');

    if (!boardContext || !nextContext || !holdContext) {
      throw new Error('Canvas rendering context could not be created.');
    }

    this.boardCtx = boardContext;
    this.nextCtx = nextContext;
    this.holdCtx = holdContext;
    this.boardCellSize = elements.board.height / VISIBLE_ROWS;
  }

  public render(game: TetrisGame): void {
    this.drawBoard(game);
    this.drawNextPieces(game.getNextPieces());
    this.drawHold(game.getHold());
    const stats = game.getStats();
    this.updateStats(stats);
    this.updateOverlay(stats);
  }

  private drawBoard(game: TetrisGame): void {
    const width = this.elements.board.width;
    const height = this.elements.board.height;
    this.boardCtx.clearRect(0, 0, width, height);

    this.boardCtx.fillStyle = 'rgba(6, 10, 20, 0.95)';
    this.boardCtx.fillRect(0, 0, width, height);

    this.drawGrid();

    const board = game.getBoard();
    for (let row = 0; row < VISIBLE_ROWS; row += 1) {
      const boardRow = row + HIDDEN_ROWS;
      for (let col = 0; col < COLS; col += 1) {
        const cell = board[boardRow]?.[col];
        if (cell) {
          this.drawCell(col, row, PIECE_COLORS[cell]);
        }
      }
    }

    const ghost = game.getGhostCells();
    this.boardCtx.save();
    this.boardCtx.globalAlpha = GHOST_ALPHA;
    ghost.forEach(({ x, y, type }) => {
      const visibleY = y - HIDDEN_ROWS;
      if (visibleY < 0 || visibleY >= VISIBLE_ROWS) {
        return;
      }
      this.drawCell(x, visibleY, PIECE_COLORS[type]);
    });
    this.boardCtx.restore();

    const active = game.getActiveCells();
    active.forEach(({ x, y, type }) => {
      const visibleY = y - HIDDEN_ROWS;
      if (visibleY < 0 || visibleY >= VISIBLE_ROWS) {
        return;
      }
      this.drawCell(x, visibleY, PIECE_COLORS[type]);
    });
  }

  private drawGrid(): void {
    const width = this.elements.board.width;
    const height = this.elements.board.height;
    const size = this.boardCellSize;

    this.boardCtx.save();
    this.boardCtx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    this.boardCtx.lineWidth = 1;

    for (let x = 1; x < COLS; x += 1) {
      const px = x * size;
      this.boardCtx.beginPath();
      this.boardCtx.moveTo(px + 0.5, 0);
      this.boardCtx.lineTo(px + 0.5, height);
      this.boardCtx.stroke();
    }

    for (let y = 1; y < VISIBLE_ROWS; y += 1) {
      const py = y * size;
      this.boardCtx.beginPath();
      this.boardCtx.moveTo(0, py + 0.5);
      this.boardCtx.lineTo(width, py + 0.5);
      this.boardCtx.stroke();
    }
    this.boardCtx.restore();
  }

  private drawCell(boardX: number, boardY: number, color: string): void {
    const size = this.boardCellSize;
    const x = boardX * size;
    const y = boardY * size;

    const gradient = this.boardCtx.createLinearGradient(x, y, x, y + size);
    gradient.addColorStop(0, shadeColor(color, 0.35));
    gradient.addColorStop(0.35, color);
    gradient.addColorStop(1, shadeColor(color, -0.3));

    this.boardCtx.fillStyle = gradient;
    this.boardCtx.fillRect(x + 1, y + 1, size - 2, size - 2);

    this.boardCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    this.boardCtx.lineWidth = 1;
    this.boardCtx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);

    this.boardCtx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    this.boardCtx.fillRect(x + 1, y + size - 6, size - 2, 5);
  }

  private drawNextPieces(pieces: PieceType[]): void {
    const ctx = this.nextCtx;
    const { width, height } = this.elements.next;
    ctx.clearRect(0, 0, width, height);
    this.fillGlassBackground(ctx, width, height);

    if (pieces.length === 0) {
      return;
    }

    const slotHeight = height / pieces.length;
    const cellSize = Math.min(width / 6, slotHeight / 4);

    pieces.forEach((piece, index) => {
      const offsetY = index * slotHeight + slotHeight / 2;
      this.drawPreviewPiece(ctx, piece, width / 2, offsetY, cellSize);
    });
  }

  private drawHold(piece: PieceType | null): void {
    const ctx = this.holdCtx;
    const { width, height } = this.elements.hold;
    ctx.clearRect(0, 0, width, height);
    this.fillGlassBackground(ctx, width, height);

    if (!piece) {
      return;
    }

    const cellSize = Math.min(width, height) / 5;
    this.drawPreviewPiece(ctx, piece, width / 2, height / 2, cellSize);
  }

  private drawPreviewPiece(
    ctx: CanvasRenderingContext2D,
    type: PieceType,
    centerX: number,
    centerY: number,
    cellSize: number
  ): void {
    const matrix = TETROMINO_SHAPES[type][0];
    const cells: Array<{ x: number; y: number }> = [];

    matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) {
          cells.push({ x, y });
        }
      });
    });

    if (cells.length === 0) {
      return;
    }

    const minX = Math.min(...cells.map((cell) => cell.x));
    const maxX = Math.max(...cells.map((cell) => cell.x));
    const minY = Math.min(...cells.map((cell) => cell.y));
    const maxY = Math.max(...cells.map((cell) => cell.y));

    const pieceWidth = (maxX - minX + 1) * cellSize;
    const pieceHeight = (maxY - minY + 1) * cellSize;

    const offsetX = centerX - pieceWidth / 2;
    const offsetY = centerY - pieceHeight / 2;

    cells.forEach(({ x, y }) => {
      const drawX = offsetX + (x - minX) * cellSize;
      const drawY = offsetY + (y - minY) * cellSize;

      const gradient = ctx.createLinearGradient(drawX, drawY, drawX, drawY + cellSize);
      gradient.addColorStop(0, shadeColor(PIECE_COLORS[type], 0.3));
      gradient.addColorStop(1, shadeColor(PIECE_COLORS[type], -0.2));
      ctx.fillStyle = gradient;
      ctx.fillRect(drawX + 1, drawY + 1, cellSize - 2, cellSize - 2);

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.strokeRect(drawX + 0.5, drawY + 0.5, cellSize - 1, cellSize - 1);
    });
  }

  private fillGlassBackground(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, 'rgba(12, 18, 36, 0.75)');
    gradient.addColorStop(1, 'rgba(6, 10, 20, 0.85)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.strokeRect(0.5, 0.5, width - 1, height - 1);
  }

  private updateStats(stats: GameStats): void {
    this.elements.score.textContent = stats.score.toLocaleString();
    this.elements.level.textContent = stats.level.toString();
    this.elements.lines.textContent = stats.lines.toString();
    this.elements.combo.textContent = stats.combo >= 0 ? stats.combo.toString() : '-';
    this.elements.backToBack.textContent = stats.backToBack.toString();
  }

  private updateOverlay(stats: GameStats): void {
    const overlay = this.elements.overlay;
    if (stats.state === 'paused') {
      overlay.textContent = 'PAUSED';
      overlay.classList.remove('hidden');
    } else if (stats.state === 'over') {
      overlay.textContent = 'GAME OVER';
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }
}

const shadeColor = (color: string, amount: number): string => {
  const hex = color.replace('#', '');
  const num = parseInt(hex, 16);
  const r = clampChannel(((num >> 16) & 0xff) * (1 + amount));
  const g = clampChannel(((num >> 8) & 0xff) * (1 + amount));
  const b = clampChannel((num & 0xff) * (1 + amount));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
};

const clampChannel = (value: number): number => {
  return Math.min(255, Math.max(0, Math.round(value)));
};
