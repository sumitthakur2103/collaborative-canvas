export class CanvasManager {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Unable to get 2D canvas context");
    }

    this.ctx = context;

    this.setupCanvas();
  }

  private setupCanvas(): void {
    const rect = this.canvas.getBoundingClientRect();

    this.canvas.width = rect.width;
    this.canvas.height = rect.height;

    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
  }

  setEraserStyle(width: number): void {
    this.ctx.globalCompositeOperation = "destination-out";
    this.ctx.lineWidth = width;
  }

  setBrushStyle(color: string, width: number): void {
    this.ctx.globalCompositeOperation = "source-over";
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
  }

  setStrokeStyle(color: string, width: number): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = width;
  }

  beginStroke(x: number, y: number): void {
    this.ctx.beginPath();
    this.ctx.moveTo(x, y);
  }

  drawTo(x: number, y: number): void {
    this.ctx.lineTo(x, y);
    this.ctx.stroke();
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }
}
