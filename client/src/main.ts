import "./style.css";

import { CanvasManager } from "./canvas";
import { DrawingController } from "./drawing";
import { WebSocketManager } from "./websocket";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App container not found");
}

app.innerHTML = `
  <div class="app-header">
    <div class="brand">
      <span class="brand-mark">✦</span>
      <span>Collaborative Canvas</span>
    </div>
  </div>

  <div class="toolbar">
    <div class="toolbar-group">
      <button
        id="undo-btn"
        class="tool-button icon-button"
        type="button"
        aria-label="Undo"
        title="Undo"
      >
        ↶
      </button>  
      <button
        id="redo-btn"
        class="tool-button icon-button"
        type="button"
        aria-label="Redo"
        title="Redo"
      >
        ↷
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <div class="toolbar-group">
      <button
        id="brush-btn"
        class="tool-button"
        type="button"
        title="Brush"
      >
        <span class="tool-icon">✎</span>
        <span>Brush</span>
      </button>

      <button
        id="eraser-btn"
        class="tool-button"
        type="button"
        title="Eraser"
      >
        <span class="tool-icon">⌫</span>
        <span>Eraser</span>
      </button>
    </div>

    <div class="toolbar-divider"></div>

    <label class="color-control" title="Choose color">
      <span class="color-label">Color</span>
      <span class="color-preview">
        <input
          id="color-picker"
          type="color"
          value="#000000"
          aria-label="Choose color"
        />
      </span>
    </label>

    <div class="toolbar-divider"></div>

    <label class="width-control" title="Stroke width">
      <span class="width-label">Width</span>

      <input
        id="width-slider"
        type="range"
        min="1"
        max="30"
        value="5"
        aria-label="Stroke width"
      />

      <span id="width-value" class="width-value">5</span>
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

const undoButton = document.getElementById("undo-btn");

undoButton?.addEventListener("click", () => {
  drawingController.undo();
});

const redoButton = document.getElementById("redo-btn");

redoButton?.addEventListener("click", () => {
  drawingController.redo();
});

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

window.addEventListener("keydown", (event) => {
  if (event.metaKey && event.key === "z" && !event.shiftKey) {
    event.preventDefault();
    drawingController.undo();
  }

  if (event.metaKey && event.shiftKey && event.key === "z") {
    event.preventDefault();
    drawingController.redo();
  }
});
