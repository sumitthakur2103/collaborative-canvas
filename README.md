# Real-Time Collaborative Drawing Canvas

A multi-user real-time collaborative drawing application built with **TypeScript**, **HTML5 Canvas**, **Node.js**, and **Socket.IO**.

Multiple users can draw on the same canvas simultaneously and see each other's drawing activity in real time.

---

## Live

```bash
https://collaborative-canvas-psi-five.vercel.app/
```

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Testing With Multiple Users](#testing-with-multiple-users)
- [How It Works](#how-it-works)
- [Global Undo/Redo](#global-undoredo)
- [Conflict Resolution](#conflict-resolution)
- [Performance Decisions](#performance-decisions)
- [Project Structure](#project-structure)
- [Known Limitations / Bugs](#known-limitations--bugs)
- [Browser Support](#browser-support)
- [Development Notes](#development-notes)
- [Time Spent](#time-spent)
- [Demo](#demo)
- [Assignment Requirements](#assignment-requirements)
- [License](#license)

---

## Features

- Brush tool
- Eraser tool
- Custom colors
- Adjustable stroke width
- Real-time drawing synchronization
- Live remote cursor positions
- Online user count
- Server-assigned user colors
- Global undo/redo
- Initial drawing state synchronization for newly connected users
- High-DPI canvas rendering
- Canvas resize handling
- Batched WebSocket stroke updates

---

## Tech Stack

### Frontend

| Technology       | Purpose                   |
| ---------------- | ------------------------- |
| TypeScript       | Application logic         |
| HTML5 Canvas API | Drawing rendering         |
| HTML / CSS       | Structure and styling     |
| Socket.IO Client | Real-time communication   |
| Vite             | Dev server and build tool |

### Backend

| Technology | Purpose                 |
| ---------- | ----------------------- |
| Node.js    | Runtime                 |
| Express    | HTTP server             |
| Socket.IO  | Real-time communication |
| TypeScript | Application logic       |

### Constraints Followed

- No React, Vue, or other frontend frameworks
- No canvas/drawing libraries
- Canvas operations implemented using the native HTML5 Canvas API
- Drawing state synchronized as operations rather than canvas images/pixels

---

## Getting Started

### Prerequisites

Make sure you have:

- Node.js 18+
- npm

Verify your installation with:

```bash
node --version
npm --version
```

### Installation

Clone the repository:

```bash
git clone https://github.com/sumitthakur2103/collaborative-canvas.git
cd collaborative-canvas
```

Install all dependencies:

```bash
npm install
```

### Start the Application

Run:

```bash
npm start
```

This starts both the frontend and backend.

| Service          | URL                   |
| ---------------- | --------------------- |
| Frontend         | http://localhost:5173 |
| Socket.IO server | http://localhost:3000 |

Open **http://localhost:5173** in your browser.

---

## Testing With Multiple Users

The easiest way to test collaboration is to open the application in multiple browser tabs or windows.

### Test Setup

1. Start the application using `npm start`.
2. Open `http://localhost:5173`.
3. Open the same URL in a second browser tab/window.
4. Each browser tab represents a separate connected user.

You should see:

```text
Online: 2
```

### Test Real-Time Drawing

1. Draw using the Brush in User A's tab.
2. Observe User A's drawing appearing in User B's tab while the stroke is still being drawn.
3. Draw from User B's tab.
4. Verify that User A receives the drawing in real time.

### Test User Cursors

- Move the mouse around in one user's canvas.
- Other users should see that user's cursor position with their assigned user color.

### Test Online Users

- Open and close browser tabs.
- The online user count should update automatically.
- When a user disconnects, their remote cursor should also disappear.

### Test Global Undo/Redo

1. User A draws a stroke.
2. User B draws another stroke.
3. Trigger Undo from either user — the latest active operation should be undone for all connected users.
4. Trigger Redo — the operation should be restored for all connected users.
5. A new drawing after an undo clears the redo history.

### Test Initial State Synchronization

1. Open User A and create several drawings.
2. Open a new browser tab.
3. The new user should immediately receive and render the existing drawing history.

### Test Simultaneous Drawing

Use two browser windows and draw at approximately the same time, including overlapping areas. Both users should be able to draw without blocking each other, and both clients should eventually show the same committed operations.

---

## How It Works

The application synchronizes **drawing operations**, not canvas pixels.

A stroke is streamed using three stages:

```text
Pointer Down
     |
     v
stroke:start
     |
     v
Pointer Movement
     |
     v
stroke:update  (batched approximately every 20ms)
     |
     v
Pointer Up
     |
     v
stroke:end
     |
     v
Server commits operation
     |
     v
operation:committed
     |
     v
All clients update their history
```

Each completed stroke becomes a drawing operation containing:

- User ID
- Tool
- Color
- Stroke width
- Points
- Timestamp
- Operation ID

The server assigns a sequence number to committed operations.

> The detailed architecture and protocol are documented in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Global Undo/Redo

Undo and redo are handled centrally by the server. The server maintains the canonical history of drawing operations.

When a user requests Undo:

```text
User
  |
  v
history:undo
  |
  v
Server
  |
  v
Find latest active operation
  |
  v
Mark operation as undone
  |
  v
history:update
  |
  v
All clients
```

Redo follows the same server-authoritative model.

This means Undo/Redo is **global across all connected users**, rather than being local to the user who pressed the button.

---

## Conflict Resolution

Multiple users can draw simultaneously without locking the canvas. Each completed stroke is treated as an independent operation.

The server assigns an increasing sequence number:

```text
User A -> Operation -> Sequence 10
User B -> Operation -> Sequence 11
```

Clients replay committed operations according to their server-assigned sequence. This provides deterministic ordering when multiple users draw in overlapping areas while allowing users to continue drawing concurrently.

---

## Performance Decisions

### Batched Stroke Updates

Pointer movement can generate many events. Instead of sending every point as an individual WebSocket message, points are collected and sent in batches approximately every 20ms. This reduces unnecessary network messages while maintaining responsive real-time drawing.

### Operation-Based State

The application does not synchronize screenshots or canvas pixels. Instead, drawing operations are stored and replayed when the canvas needs to be rebuilt. This makes the following possible without transferring the entire canvas image:

- Undo
- Redo
- Initial state synchronization
- Canvas resizing

### Separate Canvas Layers

The client uses separate canvas layers for:

- Committed operations
- Temporary live strokes

Temporary strokes can therefore be displayed in real time without becoming part of the canonical history until the server commits them.

### High-DPI Rendering

The canvas internal resolution accounts for `window.devicePixelRatio` so that drawings remain sharp on high-DPI displays.

---

## Project Structure

```text
collaborative-canvas/
│
├── client/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── src/
│       ├── canvas.ts
│       ├── drawing.ts
│       ├── websocket.ts
│       ├── main.ts
│       ├── style.css
│       └── types.ts
│
├── server/
│   └── server.ts
│
├── shared/
│   └── protocol.ts
│
├── package.json
├── README.md
└── ARCHITECTURE.md
```

---

## Known Limitations / Bugs

The current implementation intentionally focuses on the core collaborative drawing requirements.

- Drawing history is stored in server memory; restarting the server clears the current drawing state.
- There is currently one shared canvas; room-based collaboration is not implemented.
- User authentication is not implemented because it is not required by the assignment.
- Cursor positions are temporary and are not persisted.
- Very large drawing histories may eventually require snapshotting or other history optimizations.
- A stroke that is interrupted by a client disconnect before completion may require additional cleanup handling.

---

## Browser Support

The application is intended to work on modern browsers supporting:

- HTML5 Canvas
- Pointer Events
- WebSocket / Socket.IO
- Modern JavaScript features

Tested during development primarily in **Google Chrome**. The application should also be tested in modern **Firefox** and **Safari** before final submission.

---

## Development Notes

The project was developed incrementally using meaningful Git commits for major features and fixes. Examples of development checkpoints include:

```text
chore: initialize project setup
feat: setup canvas rendering
feat: implement local canvas drawing
feat: add drawing operation model
feat: establish websocket connection
feat: add drawing tools and eraser
...
fix: remove remote cursors on disconnect
feat: improve canvas resize handling
```

---

## Time Spent

`Approximately 3 days (15+ hours) of development`

---

## Demo

- **Live Demo:** `https://collaborative-canvas-psi-five.vercel.app`
- **GitHub Repository:** `https://github.com/sumitthakur2103/collaborative-canvas.git`
- **Backend(Render):** `https://collaborative-canvas-server-8eu4.onrender.com`

---

## Assignment Requirements

This project was built according to the assignment requirements:

- [x] Brush
- [x] Eraser
- [x] Different colors
- [x] Stroke width adjustment
- [x] Real-time synchronization
- [x] Live user cursors
- [x] Conflict resolution
- [x] Global undo/redo
- [x] Online user indicators
- [x] User colors
- [x] Vanilla TypeScript/HTML/CSS
- [x] HTML5 Canvas
- [x] Node.js
- [x] Socket.IO
- [x] No frontend framework
- [x] No drawing library

---

## License

This project was created as part of a Flam technical assignment.

---
