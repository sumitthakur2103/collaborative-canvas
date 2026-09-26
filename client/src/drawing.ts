import { CanvasManager } from "./canvas";
import { WebSocketManager } from "./websocket";

import type { DrawingOperation, Point } from "./types";

interface RemoteStroke {
  userId: string;
  color: string;
  width: number;
}

interface CommittedOperation {
  operation: DrawingOperation;
  sequence: number;
}

export class DrawingController {
  private websocket: WebSocketManager;
  private canvas: HTMLCanvasElement;
  private canvasManager: CanvasManager;
  private isDrawing = false;
  private currentPoints: Point[] = [];

  private readonly userId = crypto.randomUUID();
  private currentStrokeId: string | null = null;

  private remoteStrokes = new Map<string, RemoteStroke>();
  private operations: CommittedOperation[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    canvasManager: CanvasManager,
    websocket: WebSocketManager,
  ) {
    this.canvas = canvas;
    this.canvasManager = canvasManager;
    this.websocket = websocket;
    this.setupRemoteDrawing();
    this.setupEventListeners();
  }

  private renderOperation(operation: DrawingOperation): void {
    if (operation.points.length === 0) {
      return;
    }

    this.canvasManager.setStrokeStyle(operation.color, operation.width);

    const firstPoint = operation.points[0];

    this.canvasManager.beginStroke(firstPoint.x, firstPoint.y);

    for (let i = 1; i < operation.points.length; i++) {
      const point = operation.points[i];

      this.canvasManager.drawTo(point.x, point.y);
    }
  }

  private setupRemoteDrawing(): void {
    this.websocket.onStrokeStart((message) => {
      this.remoteStrokes.set(message.strokeId, {
        userId: message.userId,
        color: message.color,
        width: message.width,
      });

      this.canvasManager.setStrokeStyle(message.color, message.width);

      this.canvasManager.beginStroke(message.point.x, message.point.y);
    });

    this.websocket.onStrokeUpdate((message) => {
      const stroke = this.remoteStrokes.get(message.strokeId);

      if (!stroke) {
        return;
      }

      this.canvasManager.setStrokeStyle(stroke.color, stroke.width);

      for (const point of message.points) {
        this.canvasManager.drawTo(point.x, point.y);
      }
    });

    this.websocket.onStrokeEnd((message) => {
      this.remoteStrokes.delete(message.strokeId);
    });

    this.websocket.onOperationCommitted((message) => {
      console.log("Canonical operation received:", message);

      this.operations.push({
        operation: message.operation,
        sequence: message.sequence,
      });

      console.log("Total operations:", this.operations.length);

      console.log("Committed sequence:", message.sequence);
    });
  }

  private setupEventListeners(): void {
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);

    this.canvas.addEventListener("pointermove", this.handlePointerMove);

    this.canvas.addEventListener("pointerup", this.handlePointerUp);

    this.canvas.addEventListener("pointercancel", this.handlePointerUp);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    this.isDrawing = true;

    this.canvas.setPointerCapture(event.pointerId);

    const point = this.getCanvasPoint(event);

    this.currentPoints = [point];

    this.canvasManager.beginStroke(point.x, point.y);

    const strokeId = crypto.randomUUID();
    this.currentStrokeId = strokeId;

    this.websocket.sendStrokeStart({
      type: "stroke:start",
      strokeId,
      userId: this.userId,
      tool: "brush",
      color: "#000000",
      width: 5,
      point,
    });
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.isDrawing) {
      return;
    }

    const point = this.getCanvasPoint(event);

    this.currentPoints.push(point);

    this.canvasManager.drawTo(point.x, point.y);

    if (!this.currentStrokeId) {
      return;
    }

    this.websocket.sendStrokeUpdate({
      type: "stroke:update",
      strokeId: this.currentStrokeId,
      points: [point],
    });
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.isDrawing) {
      return;
    }

    this.isDrawing = false;

    this.canvas.releasePointerCapture(event.pointerId);

    if (this.currentStrokeId) {
      this.websocket.sendStrokeEnd({
        type: "stroke:end",
        strokeId: this.currentStrokeId,
      });
    }

    const operation: DrawingOperation = {
      id: crypto.randomUUID(),
      type: "stroke",
      userId: this.userId,
      tool: "brush",
      color: "#000000",
      width: 5,
      points: [...this.currentPoints],
      timestamp: Date.now(),
    };

    console.log("Completed operation:", operation);

    this.currentPoints = [];
    this.currentStrokeId = null;
  };

  private getCanvasPoint(event: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();

    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }
}
