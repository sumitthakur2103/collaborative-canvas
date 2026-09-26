import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

import type {
  StrokeStartMessage,
  StrokeUpdateMessage,
  StrokeEndMessage
} from "../shared/protocol";

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "http://localhost:5173",
  },
});

app.get("/", (_req, res) => {
  res.send("Collaborative Canvas Server is running");
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on(
    "stroke:start",
    (message: StrokeStartMessage) => {
      console.log("Stroke started:", message.strokeId);

      socket.broadcast.emit(
        "stroke:start",
        message
      );
    }
  );

  socket.on(
    "stroke:update",
    (message: StrokeUpdateMessage) => {
      socket.broadcast.emit(
        "stroke:update",
        message
      );
    }
  );

  socket.on(
    "stroke:end",
    (message: StrokeEndMessage) => {
      console.log("Stroke ended:", message.strokeId);

      socket.broadcast.emit(
        "stroke:end",
        message
      );
    }
  );

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

const PORT = 3000;

httpServer.listen(PORT, () => {
  console.log(
    `Server running on http://localhost:${PORT}`
  );
});