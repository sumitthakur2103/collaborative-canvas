import { CanvasManager } from "./canvas";

export interface Point {
  x: number;
  y: number;
}

export class DrawingController {
  private canvas: HTMLCanvasElement;
  private canvasManager: CanvasManager;

  private isDrawing = false;
  private currentPoints: Point[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    canvasManager: CanvasManager
  ) {
    this.canvas = canvas;
    this.canvasManager = canvasManager;

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener(
      "pointerdown",
      this.handlePointerDown
    );

    this.canvas.addEventListener(
      "pointermove",
      this.handlePointerMove
    );

    this.canvas.addEventListener(
      "pointerup",
      this.handlePointerUp
    );

    this.canvas.addEventListener(
      "pointercancel",
      this.handlePointerUp
    );
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.isDrawing = true;

    this.canvas.setPointerCapture(event.pointerId);

    const point = this.getCanvasPoint(event);

    this.currentPoints = [point];

    this.canvasManager.beginStroke(
      point.x,
      point.y
    );
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.isDrawing) {
      return;
    }

    const point = this.getCanvasPoint(event);

    this.currentPoints.push(point);

    this.canvasManager.drawTo(
      point.x,
      point.y
    );
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.isDrawing) {
      return;
    }

    this.isDrawing = false;

    this.canvas.releasePointerCapture(event.pointerId);

    console.log("Completed points:", this.currentPoints);

    this.currentPoints = [];
  };

  private getCanvasPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }
}