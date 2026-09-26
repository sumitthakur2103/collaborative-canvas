import { io, Socket } from "socket.io-client";

import type {
  StrokeStartMessage,
  StrokeUpdateMessage,
  StrokeEndMessage,
  OperationCommittedMessage,
} from "../../shared/protocol";

export class WebSocketManager {
  private socket: Socket;

  constructor() {
    this.socket = io("http://localhost:3000");

    this.setupListeners();
  }

  private operationCommittedListeners: Array<
    (message: OperationCommittedMessage) => void
  > = [];

  onOperationCommitted(
    listener: (message: OperationCommittedMessage) => void,
  ): void {
    this.operationCommittedListeners.push(listener);
  }

  private strokeStartListeners: Array<(message: StrokeStartMessage) => void> =
    [];

  private strokeUpdateListeners: Array<(message: StrokeUpdateMessage) => void> =
    [];

  private strokeEndListeners: Array<(message: StrokeEndMessage) => void> = [];

  onStrokeStart(listener: (message: StrokeStartMessage) => void): void {
    this.strokeStartListeners.push(listener);
  }

  onStrokeUpdate(listener: (message: StrokeUpdateMessage) => void): void {
    this.strokeUpdateListeners.push(listener);
  }

  onStrokeEnd(listener: (message: StrokeEndMessage) => void): void {
    this.strokeEndListeners.push(listener);
  }

  private setupListeners(): void {
    this.socket.on("connect", () => {
      console.log("Connected to server:", this.socket.id);
    });

    this.socket.on("disconnect", () => {
      console.log("Disconnected from server");
    });

    this.socket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error.message);
    });

    this.socket.on("stroke:start", (message: StrokeStartMessage) => {
      for (const listener of this.strokeStartListeners) {
        listener(message);
      }
    });

    this.socket.on("stroke:update", (message: StrokeUpdateMessage) => {
      for (const listener of this.strokeUpdateListeners) {
        listener(message);
      }
    });

    this.socket.on("stroke:end", (message: StrokeEndMessage) => {
      for (const listener of this.strokeEndListeners) {
        listener(message);
      }
    });

    this.socket.on(
      "operation:committed",
      (message: OperationCommittedMessage) => {
        for (const listener of this.operationCommittedListeners) {
          listener(message);
        }
      },
    );
  }

  sendStrokeStart(message: StrokeStartMessage): void {
    this.socket.emit("stroke:start", message);
  }

  sendStrokeUpdate(message: StrokeUpdateMessage): void {
    this.socket.emit("stroke:update", message);
  }

  sendStrokeEnd(message: StrokeEndMessage): void {
    this.socket.emit("stroke:end", message);
  }
}
