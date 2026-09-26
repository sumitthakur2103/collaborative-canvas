import "./style.css";

import { CanvasManager } from "./canvas";
import { DrawingController } from "./drawing";
import { WebSocketManager } from "./websocket";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App container not found");
}

app.innerHTML = `
  <h1>Collaborative Canvas</h1>

  <main class="canvas-container">
    <canvas id="canvas"></canvas>
  </main>
`;

const canvas = document.querySelector<HTMLCanvasElement>("#canvas");

if (!canvas) {
  throw new Error("Canvas element not found");
}

const canvasManager = new CanvasManager(canvas);

canvasManager.setStrokeStyle("#000000", 5);


const websocket = new WebSocketManager();

new DrawingController(
  canvas,
  canvasManager,
  websocket
);
