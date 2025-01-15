import { formatNumber } from '@/utils/number';

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

export const BAR_CHART_DEFAULT_PADDINGS = (maxY: number): Paddings => {
  const labelLength = formatNumber(maxY).length;
  return {
    top: 16,
    right: 16,
    bottom: 64,
    left: labelLength > 4 ? 32 + labelLength * 4 : 32,
  };
};
