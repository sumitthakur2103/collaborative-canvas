export interface Point {
  x: number;
  y: number;
}

export type DrawingTool = "brush" | "eraser";

export interface DrawingOperation {
  id: string;
  type: "stroke";

  userId: string;

  tool: DrawingTool;
  color: string;
  width: number;

  points: Point[];

  timestamp: number;
}

export interface StrokeStartMessage {
  type: "stroke:start";

  strokeId: string;
  userId: string;

  tool: DrawingTool;
  color: string;
  width: number;

  point: Point;
}

export interface StrokeUpdateMessage {
  type: "stroke:update";

  strokeId: string;

  points: Point[];
}

export interface StrokeEndMessage {
  type: "stroke:end";

  strokeId: string;
}

export interface OperationCommittedMessage {
  type: "operation:committed";

  operation: DrawingOperation;

  sequence: number;
}

export interface CursorMoveMessage {
  type: "cursor:move";
  userId: string;
  x: number;
  y: number;
}
