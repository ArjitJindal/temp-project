export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  x: number;
  y: number;
}

export interface Paddings {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_PADDINGS: Paddings = { top: 16, right: 16, bottom: 64, left: 40 };
