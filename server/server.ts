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
  HistoryOperation,
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

const history: HistoryOperation[] = [];
const redoStack: HistoryOperation[] = [];

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

    // Send existing canvas state to the newly joined user
    socket.emit("state:initial", {
      type: "state:initial",
      operations: history,
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

    activeStrokes.delete(message.strokeId);

    const sequence = nextSequence;
    nextSequence++;

    const historyOperation: HistoryOperation = {
      operation,
      sequence,
      undone: false,
    };
    history.push(historyOperation);

    // A new operation creates a new history branch,
    // so previously undone operations can no longer be redone.
    redoStack.length = 0;

    console.log("History:", history);
    socket.broadcast.emit("stroke:end", message);

    io.emit("operation:committed", {
      type: "operation:committed",
      operation,
      sequence,
    });

    // console.log("Committed operation:", operation);

    // console.log("Sequence:", sequence);
  });

  socket.on("history:undo", () => {
    for (let i = history.length - 1; i >= 0; i--) {
      if (!history[i].undone) {
        history[i].undone = true;

        redoStack.push(history[i]);

        console.log("Undo operation:", history[i]);

        io.emit("history:update", {
          type: "history:update",
          operations: history,
        });

        break;
      }
    }
  });

  socket.on("history:redo", () => {
    const historyOperation = redoStack.pop();

    if (!historyOperation) {
      console.log("Nothing to redo");
      return;
    }

    historyOperation.undone = false;

    console.log("Redo operation:", historyOperation);

    io.emit("history:update", {
      type: "history:update",
      operations: history,
    });
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
