import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import type {
  StrokeStartMessage,
  StrokeUpdateMessage,
  StrokeEndMessage,
  DrawingOperation,
  CursorMoveMessage,
  UserJoinMessage,
} from "../shared/protocol";

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

const userColorPalette = [
  "#e63946",
  "#457b9d",
  "#2a9d8f",
  "#f4a261",
  "#9b5de5",
  "#f15bb5",
];

const activeStrokes = new Map<string, DrawingOperation>();

const operations: DrawingOperation[] = [];
let nextSequence = 1;

app.get("/", (_req, res) => {
  res.send("Collaborative Canvas Server is running");
});

const connectedUsers = new Map<string, string>();
const userColors = new Map<string, string>();
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on("user:join", (message: UserJoinMessage) => {
    connectedUsers.set(message.userId, socket.id);

    const color =
      userColors.get(message.userId) ??
      userColorPalette[(connectedUsers.size - 1) % userColorPalette.length];

    userColors.set(message.userId, color);

    const users = Array.from(connectedUsers.keys()).map((userId) => ({
      userId,
      color: userColors.get(userId)!,
    }));

    io.emit("users:update", {
      type: "users:update",
      users,
    });

    console.log("User joined:", message.userId);
    console.log("Online users:", connectedUsers.size);
  });

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
    for (const [userId, socketId] of connectedUsers.entries()) {
      if (socketId === socket.id) {
        connectedUsers.delete(userId);

        const users = Array.from(connectedUsers.keys()).map((userId) => ({
          userId,
          color: userColors.get(userId)!,
        }));

        io.emit("users:update", {
          type: "users:update",
          users,
        });
        console.log("User left:", userId);
        console.log("Online users:", connectedUsers.size);

        break;
      }
    }

    console.log(`Socket disconnected: ${socket.id}`);
  });
});

const PORT = 3000;

httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
