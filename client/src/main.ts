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

  <div class="toolbar">
    <button id="brush-btn">Brush</button>
    <button id="eraser-btn">Eraser</button>

    <label>
      Color:
      <input id="color-picker" type="color" value="#000000" />
    </label>

    <label>
      Width:
      <input
        id="width-slider"
        type="range"
        min="1"
        max="30"
        value="5"
      />
      <span id="width-value">5</span>
    </label>
  </div>
  
  <div id="online-users">
    <span>Online: 0</span>
  </div>
  
  <main class="canvas-container">
    <canvas id="committed-canvas"></canvas>
    <canvas id="live-canvas"></canvas>
  </main>
`;

const committedCanvas =
  document.querySelector<HTMLCanvasElement>("#committed-canvas");

const liveCanvas = document.querySelector<HTMLCanvasElement>("#live-canvas");

if (!committedCanvas || !liveCanvas) {
  throw new Error("Canvas elements not found");
}

const committedCanvasManager = new CanvasManager(committedCanvas);

const liveCanvasManager = new CanvasManager(liveCanvas);

liveCanvasManager.setStrokeStyle("#000000", 5);

const websocket = new WebSocketManager();

const drawingController = new DrawingController(
  liveCanvas,
  liveCanvasManager,
  committedCanvasManager,
  websocket,
);

const brushButton = document.querySelector<HTMLButtonElement>("#brush-btn");

const eraserButton = document.querySelector<HTMLButtonElement>("#eraser-btn");

const colorPicker = document.querySelector<HTMLInputElement>("#color-picker");

const widthSlider = document.querySelector<HTMLInputElement>("#width-slider");

const widthValue = document.querySelector<HTMLSpanElement>("#width-value");

if (
  !brushButton ||
  !eraserButton ||
  !colorPicker ||
  !widthSlider ||
  !widthValue
) {
  throw new Error("Toolbar elements not found");
}

brushButton.addEventListener("click", () => {
  drawingController.setTool("brush");
});

eraserButton.addEventListener("click", () => {
  drawingController.setTool("eraser");
});

colorPicker.addEventListener("input", () => {
  drawingController.setColor(colorPicker.value);
});

widthSlider.addEventListener("input", () => {
  const width = Number(widthSlider.value);

  drawingController.setWidth(width);

  widthValue.textContent = String(width);
});
