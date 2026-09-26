import { CanvasManager } from "./canvas";
import { WebSocketManager } from "./websocket";

import type { DrawingOperation, Point } from "./types";

interface LiveStroke {
  operation: DrawingOperation;
}

interface CommittedOperation {
  operation: DrawingOperation;
  sequence: number;
}

export class DrawingController {
  private websocket: WebSocketManager;
  private canvas: HTMLCanvasElement;
  private canvasManager: CanvasManager;
  private committedCanvasManager: CanvasManager;
  private isDrawing = false;
  private currentPoints: Point[] = [];
  private currentTool: "brush" | "eraser" = "brush";
  private currentColor = "#000000";
  private currentWidth = 5;
  private readonly userId = crypto.randomUUID();
  private currentStrokeId: string | null = null;
  private liveStrokes = new Map<string, LiveStroke>();
  private operations: CommittedOperation[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    canvasManager: CanvasManager,
    committedCanvasManager: CanvasManager,
    websocket: WebSocketManager,
  ) {
    this.canvas = canvas;
    this.canvasManager = canvasManager;
    this.committedCanvasManager = committedCanvasManager;
    this.websocket = websocket;
    this.setupRemoteDrawing();
    this.setupEventListeners();
  }

  setTool(tool: "brush" | "eraser"): void {
    this.currentTool = tool;
  }

  setColor(color: string): void {
    this.currentColor = color;
  }

  setWidth(width: number): void {
    this.currentWidth = width;
  }
  private renderOperation(
    operation: DrawingOperation,
    canvasManager: CanvasManager,
  ): void {
    if (operation.points.length === 0) {
      return;
    }

    if (operation.tool === "eraser") {
      canvasManager.setEraserStyle(operation.width);
    } else {
      canvasManager.setBrushStyle(operation.color, operation.width);
    }

    const firstPoint = operation.points[0];

    canvasManager.beginStroke(firstPoint.x, firstPoint.y);

    for (let i = 1; i < operation.points.length; i++) {
      const point = operation.points[i];

      canvasManager.drawTo(point.x, point.y);
    }
  }

  private renderCommittedOperations(): void {
    this.committedCanvasManager.clear();

    const sortedOperations = [...this.operations].sort(
      (a, b) => a.sequence - b.sequence,
    );

    for (const committed of sortedOperations) {
      this.renderOperation(committed.operation, this.committedCanvasManager);
    }
  }

  private renderLiveStrokes(): void {
    this.canvasManager.clear();

    for (const liveStroke of this.liveStrokes.values()) {
      this.renderOperation(liveStroke.operation, this.canvasManager);
    }
  }

  private setupRemoteDrawing(): void {
    this.websocket.onStrokeStart((message) => {
      const operation: DrawingOperation = {
        id: message.strokeId,
        type: "stroke",
        userId: message.userId,
        tool: message.tool,
        color: message.color,
        width: message.width,
        points: [message.point],
        timestamp: Date.now(),
      };

      this.liveStrokes.set(message.strokeId, {
        operation,
      });
      if (message.tool === "eraser") {
        this.canvasManager.setEraserStyle(message.width);
      } else {
        this.canvasManager.setBrushStyle(message.color, message.width);
      }

      this.canvasManager.beginStroke(message.point.x, message.point.y);
    });

    this.websocket.onStrokeUpdate((message) => {
      const liveStroke = this.liveStrokes.get(message.strokeId);

      if (!liveStroke) {
        return;
      }

      for (const point of message.points) {
        liveStroke.operation.points.push(point);
      }

      if (liveStroke.operation.tool === "eraser") {
        this.canvasManager.setEraserStyle(liveStroke.operation.width);
      } else {
        this.canvasManager.setBrushStyle(
          liveStroke.operation.color,
          liveStroke.operation.width,
        );
      }

      for (const point of message.points) {
        this.canvasManager.drawTo(point.x, point.y);
      }
    });

    this.websocket.onStrokeEnd((message) => {
      console.log("Remote stroke ended:", message.strokeId);
    });

    this.websocket.onOperationCommitted((message) => {
      console.log("Canonical operation received:", message);

      this.operations.push({
        operation: message.operation,
        sequence: message.sequence,
      });

      this.liveStrokes.delete(message.operation.id);

      this.renderCommittedOperations();

      this.renderLiveStrokes();

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

    if (this.currentTool === "eraser") {
      this.canvasManager.setEraserStyle(this.currentWidth);
    } else {
      this.canvasManager.setBrushStyle(this.currentColor, this.currentWidth);
    }

    this.canvasManager.beginStroke(point.x, point.y);

    const strokeId = crypto.randomUUID();
    this.currentStrokeId = strokeId;

    const operation: DrawingOperation = {
      id: strokeId,
      type: "stroke",
      userId: this.userId,
      tool: this.currentTool,
      color: this.currentColor,
      width: this.currentWidth,
      points: [point],
      timestamp: Date.now(),
    };

    this.liveStrokes.set(strokeId, {
      operation,
    });

    this.websocket.sendStrokeStart({
      type: "stroke:start",
      strokeId,
      userId: this.userId,
      tool: this.currentTool,
      color: this.currentColor,
      width: this.currentWidth,
      point,
    });
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.isDrawing) {
      return;
    }

    const point = this.getCanvasPoint(event);

    this.currentPoints.push(point);

    if (this.currentStrokeId) {
      const liveStroke = this.liveStrokes.get(this.currentStrokeId);

      if (liveStroke) {
        liveStroke.operation.points.push(point);
      }
    }

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
