export const TOP_PADDING = 10;
export const BOTTOM_PADDING = 20;
export const LEFT_PADDING = 80;
export const RIGHT_PADDING = 0;
export const GAP = 10;
export const MAX_COLUMN_WIDTH = 150;

export function calculateScaleMax(maxValue: number): number {
  let order = 0;
  let value = maxValue;
  while (value > 1) {
    order++;
    value = value / 10;
  }

  if (value <= 0.25) {
    value = 0.25;
  } else if (value <= 0.5) {
    value = 0.5;
  } else if (value <= 0.75) {
    value = 0.75;
  } else {
    value = 1;
  }
  return value * Math.pow(10, order);
}
