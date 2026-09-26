import "./style.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App container not found");
}

app.innerHTML = `
  <h1>Collaborative Canvas</h1>
  <canvas id="canvas"></canvas>
`;