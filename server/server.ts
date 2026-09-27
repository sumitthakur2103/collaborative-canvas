import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import type {
  StrokeStartMessage,
  StrokeUpdateMessage,
  StrokeEndMessage,
  DrawingOperation,
  CursorMoveMessage,
} from "../shared/protocol";

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

const activeStrokes = new Map<string, DrawingOperation>();

const operations: DrawingOperation[] = [];
let nextSequence = 1;

app.get("/", (_req, res) => {
  res.send("Collaborative Canvas Server is running");
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("stroke:start", (message: StrokeStartMessage) => {
    console.log("Stroke started:", message.strokeId);

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

    activeStrokes.set(message.strokeId, operation);

    socket.broadcast.emit("stroke:start", message);
  });

  socket.on("stroke:update", (message: StrokeUpdateMessage) => {
    const operation = activeStrokes.get(message.strokeId);

    if (!operation) {
      return;
    }

    operation.points.push(...message.points);

    socket.broadcast.emit("stroke:update", message);
  });

  socket.on("stroke:end", (message: StrokeEndMessage) => {
    console.log("Stroke ended:", message.strokeId);

    const operation = activeStrokes.get(message.strokeId);

    if (!operation) {
      return;
    }

    operations.push(operation);

    activeStrokes.delete(message.strokeId);

    const sequence = nextSequence;
    nextSequence++;

    socket.broadcast.emit("stroke:end", message);

    io.emit("operation:committed", {
      type: "operation:committed",
      operation,
      sequence,
    });

    console.log("Committed operation:", operation);

    console.log("Sequence:", sequence);
  });

  socket.on("cursor:move", (message: CursorMoveMessage) => {
    socket.broadcast.emit("cursor:move", message);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
