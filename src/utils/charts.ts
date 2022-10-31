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
