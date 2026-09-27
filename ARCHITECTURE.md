# Architecture — Real-Time Collaborative Drawing Canvas

## 1. Overview

The Real-Time Collaborative Drawing Canvas is a multi-user drawing application where multiple users can draw on the same canvas simultaneously.

The application uses:

- **Vanilla TypeScript**
- **HTML5 Canvas**
- **Node.js**
- **Express**
- **Socket.IO**
- **Vite**

The application synchronizes **drawing operations** rather than synchronizing canvas pixels or screenshots.

The server acts as the source of truth for committed drawing operations and global history.

---

## 2. System Architecture

The application is divided into three main parts:

```text
┌──────────────────────────────────────────────────────────────┐
│                         Client                                │
│                                                                │
│  ┌───────────────┐    ┌────────────────┐    ┌────────────┐   │
│  │      UI       │    │    Drawing     │    │   Canvas   │   │
│  │               │───▶│   Controller   │───▶│  Manager   │   │
│  │ Toolbar       │    │                │    │            │   │
│  │ Color         │    │ Pointer Events │    │ HTML5      │   │
│  │ Width         │    │ History        │    │ Canvas     │   │
│  │ Undo / Redo   │    │ Live Strokes   │    │            │   │
│  └───────────────┘    └───────┬────────┘    └────────────┘   │
│                                │                              │
│                                ▼                              │
│                        ┌────────────────┐                     │
│                        │   WebSocket    │                     │
│                        │    Manager     │                     │
│                        └───────┬────────┘                     │
└────────────────────────────────┼───────────────────────────────┘
                                  │
                           Socket.IO / WebSocket
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                         Server                                │
│                                                                │
│  ┌────────────────┐    ┌────────────────┐                     │
│  │    Socket.IO   │───▶│ Drawing State  │                     │
│  │    Handlers    │    │                │                     │
│  └────────────────┘    │ Active Strokes │                     │
│                         │ History        │                     │
│                         │ Redo Stack     │                     │
│                         │ User Presence  │                     │
│                         └────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
```

### Main Components

#### Client

**`drawing.ts`**

Responsible for:

- Handling pointer events
- Managing the current drawing stroke
- Rendering local strokes
- Rendering remote live strokes
- Maintaining client-side history
- Handling undo/redo requests
- Managing remote cursors
- Updating online user information

**`canvas.ts`**

Provides a small abstraction over the native HTML5 Canvas API.

Responsible for:

- Canvas initialization
- Brush rendering
- Eraser rendering
- Stroke rendering
- Canvas clearing
- Canvas resizing
- High-DPI rendering

**`websocket.ts`**

Provides a client-side abstraction around Socket.IO.

Responsible for:

- Establishing the connection
- Sending WebSocket messages
- Receiving server messages
- Notifying the drawing controller about incoming events

**`protocol.ts`**

Contains the shared TypeScript message and data definitions used by both the client and server.

This keeps the client/server communication contract consistent.

#### Server

**`server.ts`**

Responsible for:

- Creating the Express server
- Creating the Socket.IO server
- Managing connected users
- Assigning user colors
- Handling drawing events
- Maintaining active strokes
- Maintaining committed history
- Managing global undo/redo
- Assigning operation sequence numbers
- Broadcasting updates to connected clients

---

## 3. Data Flow

The main drawing flow is:

```text
User Pointer Event
        │
        ▼
DrawingController
        │
        ├───────────────▶ Local Canvas
        │
        ▼
Socket.IO Client
        │
        │ stroke:start
        │ stroke:update
        │ stroke:end
        ▼
Node.js + Socket.IO Server
        │
        ├── Active Stroke
        │
        ├── Drawing History
        │
        └── Sequence Number
        │
        ▼
Canonical Operation
        │
        ▼
Socket.IO Broadcast
        │
        ▼
All Connected Clients
        │
        ├── Update History
        │
        ├── Remove Temporary Stroke
        │
        └── Re-render Canvas
```

---

## 4. Drawing Operation Model

The application does not treat the canvas pixels as the source of truth.

Instead, every completed stroke is represented as a `DrawingOperation`.

```text
DrawingOperation
├── id
├── type
├── userId
├── tool
├── color
├── width
├── points[]
└── timestamp
```

The important idea is:

```text
Canvas Pixels
     ↑
     │
   Render
     │
Drawing Operations
     ↑
     │
Server History
```

This operation-based approach makes it possible to:

- Synchronize drawing state
- Rebuild the canvas
- Implement global undo/redo
- Synchronize newly connected users
- Recover the canvas after resizing

without transferring the complete canvas image.

---

## 5. Real-Time Drawing Flow

A stroke is divided into three phases.

### 5.1 Stroke Start

When the user presses the pointer:

```text
pointerdown
     │
     ▼
Create stroke ID
     │
     ▼
Create local DrawingOperation
     │
     ▼
Render locally
     │
     ▼
stroke:start
```

The `stroke:start` message contains:

- Stroke ID
- User ID
- Tool
- Color
- Width
- Initial point

### 5.2 Stroke Update

While the user is drawing, pointer movement generates points.

Instead of immediately sending every pointer event, points are temporarily collected.

```text
Pointer Events
      │
      ▼
Collect Points
      │
      ▼
Batch approximately every 20ms
      │
      ▼
stroke:update
```

This reduces the number of WebSocket messages while maintaining responsive real-time drawing.

The temporary stroke is also rendered locally and remotely.

### 5.3 Stroke End

When the pointer is released:

```text
pointerup
    │
    ▼
Flush pending points
    │
    ▼
stroke:end
    │
    ▼
Server commits operation
    │
    ▼
Assign sequence number
    │
    ▼
operation:committed
```

The server then adds the operation to canonical history.

---

## 6. WebSocket Protocol

The client and server communicate using Socket.IO events.

The protocol definitions are shared through:

```text
shared/protocol.ts
```

This prevents the client and server from using inconsistent message structures.

### 6.1 User Presence

#### `user:join`

**Direction:** `Client → Server`

Used when a client connects and identifies itself.

Payload:

```ts
{
  type: "user:join";
  userId: string;
}
```

#### `users:update`

**Direction:** `Server → Clients`

Contains the current list of connected users.

Payload:

```ts
{
  type: "users:update";
  users: UserPresence[];
}
```

Each user contains:

```ts
{
  userId: string;
  color: string;
}
```

The client uses this information to display:

- Online user count
- User colors
- Remote cursor colors

### 6.2 Drawing Events

#### `stroke:start`

**Direction:** `Client → Server → Other Clients`

Starts a temporary live stroke.

Payload:

```ts
{
  type: "stroke:start";
  strokeId: string;
  userId: string;
  tool: "brush" | "eraser";
  color: string;
  width: number;
  point: Point;
}
```

#### `stroke:update`

**Direction:** `Client → Server → Other Clients`

Sends additional points for an active stroke.

Payload:

```ts
{
  type: "stroke:update";
  strokeId: string;
  points: Point[];
}
```

Points are sent in batches instead of sending every pointer event individually.

#### `stroke:end`

**Direction:** `Client → Server → Other Clients`

Indicates that the user has finished the stroke.

Payload:

```ts
{
  type: "stroke:end";
  strokeId: string;
}
```

#### `operation:committed`

**Direction:** `Server → Clients`

Sent after the server has converted an active stroke into a canonical drawing operation.

Payload:

```ts
{
  type: "operation:committed";
  operation: DrawingOperation;
  sequence: number;
}
```

The sequence number is assigned by the server.

### 6.3 Cursor Events

#### `cursor:move`

**Direction:** `Client → Server → Other Clients`

Used to synchronize cursor positions.

Payload:

```ts
{
  type: "cursor:move";
  userId: string;
  x: number;
  y: number;
}
```

Cursor information is treated as temporary presence information and is not stored in drawing history.

### 6.4 History Events

#### `history:undo`

**Direction:** `Client → Server`

Requests a global undo.

Payload:

```ts
{
  type: "history:undo";
}
```

#### `history:redo`

**Direction:** `Client → Server`

Requests a global redo.

Payload:

```ts
{
  type: "history:redo";
}
```

#### `history:update`

**Direction:** `Server → Clients`

Broadcasts the updated canonical history.

Payload:

```ts
{
  type: "history:update";
  operations: HistoryOperation[];
}
```

A `HistoryOperation` contains:

```ts
{
  operation: DrawingOperation;
  sequence: number;
  undone: boolean;
}
```

### 6.5 Initial State

#### `state:initial`

**Direction:** `Server → Newly Connected Client`

When a new user joins, the server sends the current drawing history.

Payload:

```ts
{
  type: "state:initial";
  operations: HistoryOperation[];
}
```

The client then renders all active operations.

This allows a newly connected user to immediately see the existing canvas state.

---

## 7. State Synchronization

The server is the source of truth for committed drawing operations.

The server maintains:

```text
history
activeStrokes
redoStack
connectedUsers
userColors
nextSequence
```

The client maintains temporary rendering state and a copy of the canonical history received from the server.

The general synchronization model is:

```text
             SERVER
                │
       Canonical History
                │
        ┌───────┴───────┐
        ▼               ▼
     Client A        Client B
        │               │
        ▼               ▼
     Canvas           Canvas
```

When the server broadcasts a history update, all clients replace their local history representation and re-render the committed canvas.

---

## 8. Global Undo/Redo Strategy

Undo and redo are handled globally by the server.

They are not maintained independently by each user.

### History Representation

Each operation contains:

```ts
{
  (operation, sequence, undone);
}
```

Example:

```text
History

Sequence 1 → Operation A → active
Sequence 2 → Operation B → active
Sequence 3 → Operation C → active
```

### Undo

When Undo is requested:

```text
User
  │
  ▼
history:undo
  │
  ▼
Server
  │
  ▼
Find latest active operation
  │
  ▼
Set undone = true
  │
  ▼
Push operation to redo stack
  │
  ▼
history:update
  │
  ▼
All Clients
```

The clients then:

1. Replace their history.
2. Remove the undone operation during rendering.
3. Rebuild the committed canvas from active operations.

### Redo

When Redo is requested:

```text
User
  │
  ▼
history:redo
  │
  ▼
Server
  │
  ▼
Pop operation from redo stack
  │
  ▼
Set undone = false
  │
  ▼
history:update
  │
  ▼
All Clients
```

The operation becomes visible again.

### New Operation After Undo

The implementation follows a linear history model.

If the history is:

```text
A → B → C
```

and the user performs Undo:

```text
A → B → C(undone)
```

then creates a new operation `D`:

```text
A → B → D
```

The redo stack is cleared when the new operation is committed.

This prevents ambiguous branching history.

---

## 9. Conflict Resolution

Multiple users are allowed to draw simultaneously.

The canvas is not locked when a user starts drawing.

For example:

```text
User A ────────────────┐
                        │
                        ▼
                     Server
                        ▲
                        │
User B ────────────────┘
```

Each stroke is treated as an independent operation.

The server assigns a monotonically increasing sequence number when an operation is committed.

Example:

```text
User A → Operation A → Sequence 10
User B → Operation B → Sequence 11
```

Clients render committed operations in sequence order.

This provides deterministic ordering when operations overlap.

### Why no locking?

Locking the entire canvas would prevent users from drawing simultaneously.

Instead, independent drawing operations allow:

- Concurrent drawing
- Overlapping strokes
- No user blocking
- Deterministic final ordering

The system therefore resolves conflicts through **operation ordering rather than canvas locking**.

---

## 10. Canvas Rendering Strategy

The client uses separate canvas layers.

```text
┌──────────────────────────────┐
│ Live Canvas                  │
│                               │
│ Temporary active strokes     │
└──────────────────────────────┘
              ▲
              │
┌──────────────────────────────┐
│ Committed Canvas              │
│                               │
│ Canonical drawing history     │
└──────────────────────────────┘
```

### Committed Canvas

The committed canvas contains operations that have been accepted by the server.

It is rebuilt from:

```text
history
   ↓
active operations
   ↓
renderOperation()
   ↓
committed canvas
```

### Live Canvas

The live canvas contains temporary strokes that are currently being drawn.

This allows users to see remote drawing activity before the operation is committed.

When the server commits the operation:

```text
Live Stroke
    ↓
operation:committed
    ↓
Remove temporary stroke
    ↓
Add operation to history
    ↓
Render committed history
```

---

## 11. Eraser Implementation

The eraser is implemented using the native Canvas compositing API.

Brush mode uses:

```ts
globalCompositeOperation = "source-over";
```

Eraser mode uses:

```ts
globalCompositeOperation = "destination-out";
```

This allows the eraser to remove pixels from the existing canvas without requiring a drawing library.

The eraser is also represented as a normal drawing operation, which means it participates in:

- Real-time synchronization
- History
- Undo
- Redo

---

## 12. Performance Decisions

### 12.1 Batched Network Updates

Pointer events can occur at a high frequency.

Sending every point separately would create unnecessary network traffic.

The client therefore:

1. Collects points.
2. Stores them in `pendingPoints`.
3. Sends them approximately every 20ms.

```text
Many Pointer Events
        │
        ▼
pendingPoints[]
        │
        ▼
20ms Batch
        │
        ▼
stroke:update
```

### 12.2 Operation-Based Synchronization

The application does not send canvas screenshots or pixel buffers.

Instead, it synchronizes structured drawing operations.

Benefits:

- Smaller logical messages
- Easier state reconstruction
- Global undo/redo
- Initial state synchronization
- Canvas resize recovery

### 12.3 Efficient Redrawing

When history changes, the committed canvas is cleared and rebuilt from the active operations.

```text
History Update
      │
      ▼
Clear Canvas
      │
      ▼
Filter Active Operations
      │
      ▼
Sort by Sequence
      │
      ▼
Replay Operations
```

This keeps the rendering deterministic across clients.

### 12.4 High-DPI Canvas

The canvas uses:

```ts
window.devicePixelRatio;
```

to increase the internal canvas resolution on high-DPI displays.

The CSS size remains the logical display size while the internal canvas buffer is scaled according to the device pixel ratio.

This improves visual sharpness without changing the logical drawing coordinates.

---

## 13. User Presence

The server maintains connected users and assigns each user a color.

```text
Connected Users
      │
      ▼
User ID + Color
      │
      ▼
users:update
      │
      ▼
Clients
```

The client uses the information to display:

- Online user count
- User color indicators
- Remote cursor colors

When a user disconnects, the server broadcasts an updated user list.

The client reconciles its remote cursor map with the active user list and removes cursors belonging to disconnected users.

---

## 14. Error Handling and Edge Cases

The implementation handles several common cases:

**WebSocket Connection Errors**

The client listens for Socket.IO connection errors and logs them.

**User Disconnect**

When a user disconnects:

- The server removes them from connected users.
- Updated presence is broadcast.
- Other clients remove the disconnected user's cursor.

**Empty Undo / Redo**

If there is no applicable operation to undo or redo, the server does not modify the history.

**New User Joining**

A newly connected user receives the current canonical history through `state:initial`.

**Canvas Resize**

When the browser is resized:

1. Both canvas layers are resized.
2. Canvas buffers are recreated.
3. Committed history is replayed.
4. Active live strokes are replayed.

This avoids losing the logical drawing state when the canvas buffer changes.

---

## 15. Current Limitations

The current implementation intentionally focuses on the core assignment requirements.

Known limitations include:

- Drawing history is stored in server memory.
- Restarting the server clears the current drawing state.
- Only one shared canvas is currently supported.
- Room-based collaboration is not implemented.
- User authentication is not implemented.
- Cursor positions are ephemeral.
- Large histories may eventually require snapshots or other optimizations.
- A client disconnecting during an unfinished stroke may require additional active-stroke cleanup logic.

---

## 16. Future Improvements

Potential future improvements include:

- Multiple collaborative rooms
- Persistent drawing sessions
- Database-backed history
- Touch/mobile-specific optimizations
- Drawing shapes
- Text and image tools
- Performance and latency metrics
- Canvas history snapshots
- Improved reconnection handling
- Better handling of interrupted strokes

These features are intentionally outside the current core implementation.

---

## 17. Design Summary

The main architectural decisions can be summarized as follows:

```text
1. Synchronize operations, not canvas pixels.

2. Treat a complete stroke as one canonical operation.

3. Stream active strokes using:
   stroke:start
   stroke:update
   stroke:end

4. Batch pointer points approximately every 20ms.

5. Keep live strokes separate from committed history.

6. Let the server assign operation sequence numbers.

7. Keep global undo/redo on the server.

8. Use server history as the source of truth.

9. Replay operations to rebuild the canvas.

10. Allow concurrent drawing instead of locking the canvas.
```

The architecture intentionally favors a simple, understandable design focused on the core collaborative drawing requirements rather than introducing unnecessary infrastructure or abstractions.
