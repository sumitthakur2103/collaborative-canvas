import { CanvasManager } from "./canvas";
import { WebSocketManager } from "./websocket";

import type { DrawingOperation, Point } from "./types";
import type { UserPresence, HistoryOperation } from "../../shared/protocol";
interface LiveStroke {
  operation: DrawingOperation;
}

export class DrawingController {
  private websocket: WebSocketManager;
  private canvas: HTMLCanvasElement;
  private canvasManager: CanvasManager;
  private committedCanvasManager: CanvasManager;
  private isDrawing = false;
  private currentPoints: Point[] = [];
  private pendingPoints: Point[] = [];
  private updateTimer: number | null = null;
  private currentTool: "brush" | "eraser" = "brush";
  private currentColor = "#000000";
  private currentWidth = 5;
  private readonly userId = crypto.randomUUID();
  private currentStrokeId: string | null = null;
  private liveStrokes = new Map<string, LiveStroke>();
  private remoteCursors = new Map<string, HTMLDivElement>();
  private userColors = new Map<string, string>();
  private history: HistoryOperation[] = [];
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

    this.websocket.onUsersUpdate((message) => {
      this.userColors.clear();

      for (const user of message.users) {
        this.userColors.set(user.userId, user.color);
      }

      this.updateOnlineUsers(message.users);
    });

    this.websocket.onConnect(() => {
      this.websocket.sendUserJoin({
        type: "user:join",
        userId: this.userId,
      });
    });

    this.websocket.onHistoryUpdate((message) => {
      this.history = message.operations;
      this.renderHistory();
    });
  }

  private renderHistory(): void {
    this.committedCanvasManager.clear();

    const activeOperations = this.history
      .filter((item) => !item.undone)
      .sort((a, b) => a.sequence - b.sequence);

    for (const item of activeOperations) {
      this.renderOperation(item.operation, this.committedCanvasManager);
    }
  }
  public undo(): void {
    this.websocket.sendUndo();
  }
  private updateOnlineUsers(users: UserPresence[]): void {
    const container = document.getElementById("online-users");

    if (!container) {
      return;
    }

    container.innerHTML = "";

    const title = document.createElement("span");
    title.textContent = `Online: ${users.length}`;

    container.appendChild(title);

    for (const user of users) {
      const userDot = document.createElement("span");

      userDot.style.display = "inline-block";
      userDot.style.width = "10px";
      userDot.style.height = "10px";
      userDot.style.borderRadius = "50%";
      userDot.style.backgroundColor = user.color;
      userDot.style.marginLeft = "8px";

      container.appendChild(userDot);
    }
  }

  private createRemoteCursor(userId: string): HTMLDivElement {
    const cursor = document.createElement("div");

    cursor.style.position = "absolute";
    cursor.style.width = "12px";
    cursor.style.height = "12px";
    cursor.style.borderRadius = "50%";
    // cursor.style.backgroundColor = "red";
    cursor.style.background = this.userColors.get(userId) ?? "#ff0000";
    cursor.style.border = "2px solid white";
    cursor.style.pointerEvents = "none";
    cursor.style.transform = "translate(-50%, -50%)";
    cursor.style.zIndex = "3";

    cursor.dataset.userId = userId;

    this.canvas.parentElement?.appendChild(cursor);

    return cursor;
  }

  private flushPendingPoints(): void {
    console.log("Sending batch:", this.pendingPoints.length, "points");
    if (!this.currentStrokeId || this.pendingPoints.length === 0) {
      return;
    }

    this.websocket.sendStrokeUpdate({
      type: "stroke:update",
      strokeId: this.currentStrokeId,
      points: [...this.pendingPoints],
    });

    this.pendingPoints = [];
  }

  private scheduleStrokeUpdate(): void {
    if (this.updateTimer !== null) {
      return;
    }

    this.updateTimer = window.setTimeout(() => {
      this.updateTimer = null;

      this.flushPendingPoints();
    }, 20);
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

    this.websocket.onCursorMove((message) => {
      let cursor = this.remoteCursors.get(message.userId);

      if (!cursor) {
        cursor = this.createRemoteCursor(message.userId);

        this.remoteCursors.set(message.userId, cursor);
      }

      cursor.style.left = `${message.x}px`;
      cursor.style.top = `${message.y}px`;
    });

    this.websocket.onOperationCommitted((message) => {
      console.log("Canonical operation received:", message);

      this.history.push({
        operation: message.operation,
        sequence: message.sequence,
        undone: false,
      });

      this.liveStrokes.delete(message.operation.id);

      this.renderHistory();
      this.renderLiveStrokes();

      console.log("Total history operations:", this.history.length);
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
    const point = this.getCanvasPoint(event);

    this.websocket.sendCursorMove({
      type: "cursor:move",
      userId: this.userId,
      x: point.x,
      y: point.y,
    });

    if (!this.isDrawing) {
      return;
    }

    this.currentPoints.push(point);

    this.pendingPoints.push(point);

    if (this.currentStrokeId) {
      const liveStroke = this.liveStrokes.get(this.currentStrokeId);

      if (liveStroke) {
        liveStroke.operation.points.push(point);
      }
    }

    this.canvasManager.drawTo(point.x, point.y);

    this.scheduleStrokeUpdate();

    if (!this.currentStrokeId) {
      return;
    }

    // this.websocket.sendStrokeUpdate({
    //   type: "stroke:update",
    //   strokeId: this.currentStrokeId,
    //   points: [point],
    // });
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.isDrawing) {
      return;
    }

    this.isDrawing = false;

    this.canvas.releasePointerCapture(event.pointerId);

    if (this.currentStrokeId) {
      if (this.updateTimer !== null) {
        window.clearTimeout(this.updateTimer);
        this.updateTimer = null;
      }

      this.flushPendingPoints();

      this.websocket.sendStrokeEnd({
        type: "stroke:end",
        strokeId: this.currentStrokeId,
      });
    }

    this.currentPoints = [];
    this.pendingPoints = [];
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
