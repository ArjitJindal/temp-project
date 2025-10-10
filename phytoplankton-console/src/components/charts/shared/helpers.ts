import { ScaleBand, ScaleLinear, ScalePoint } from 'd3-scale';
import {
  DEFAULT_AXIS_FONT_STYLE,
  FontStyle,
  measureTextSize,
} from '@/components/charts/shared/text';
import { DEFAULT_NUMBER_FORMATTER } from '@/components/charts/shared/formatting';

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

export const DEFAULT_PADDINGS: Paddings = { top: 16, right: 16, bottom: 16, left: 16 };

export const DEFAULT_X_AXIS_LABEL_ANGLE = -(Math.PI / 4);

export const calcAxisPaddings = (
  yLabels: string[],
  xLabels: string[],
  fontStyle: FontStyle = DEFAULT_AXIS_FONT_STYLE,
  xAngle = DEFAULT_X_AXIS_LABEL_ANGLE,
): {
  top: number;
  left: number;
  bottom: number;
} => {
  const maxYlength = yLabels.reduce((result, label) => {
    const length = measureTextSize(label, fontStyle).width;
    return Math.max(result, length);
  }, 0);

  const labelHeight = measureTextSize('0', fontStyle).height;

  const maxXlength = xLabels.reduce((result, label) => {
    const length = measureTextSize(label, fontStyle).width;
    return Math.max(result, length);
  }, 0);

  return {
    top: labelHeight / 2,
    left: maxYlength,
    bottom: Math.max(labelHeight * 3, Math.max(0, maxXlength * -1 * Math.sin(xAngle))),
  };
};

export type AbstractPlotScales<X extends { toString(): string }> = {
  xScale: ScaleBand<X> | ScalePoint<X>;
  yScale: ScaleLinear<number, number>;
};

/**
  This function is used to adjust both scales and padding so that all the axis
  ticks would fit into the chart and scales would be appropriately fixed to new
  paddings
 */
export function adjustScalesAndPaddings<
  X extends { toString(): string },
  Scales extends AbstractPlotScales<X>,
>(
  initialPaddings: Paddings,
  getScales: (paddings: Paddings) => Scales,
): { scales: Scales; paddings: Paddings } {
  const initialScales = getScales(initialPaddings);

  // Calculate size required for axis labels
  const axisPaddings = calcAxisPaddings(
    initialScales.yScale.ticks().map(DEFAULT_NUMBER_FORMATTER),
    initialScales.xScale.domain().map((x) => x.toString()),
  );

  // Adjust left and bottom paddings by scales ticks
  const newPaddings = {
    ...initialPaddings,
    top: initialPaddings.top + axisPaddings.top,
    left: initialPaddings.left + axisPaddings.left,
    bottom: initialPaddings.bottom + axisPaddings.bottom,
  };

  // Recalculate scale using new paddings
  const newScales = getScales(newPaddings);

  return {
    scales: newScales,
    paddings: newPaddings,
  };
}

export const generateEvenTicks = (scale: ScaleLinear<number, number>, maxTicks = 10): number[] => {
  const domain = scale.domain();
  const min = Math.min(...domain);
  const max = Math.max(...domain);
  const range = max - min;

  if (range < 1) {
    return [min, max];
  }

  const roughStep = range / (maxTicks - 1);
  let step: number;

  if (roughStep <= 1e-9) {
    step = 1;
  } else {
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    step = Math.ceil(roughStep / magnitude) * magnitude;
  }

  const normalizedStep = Math.max(1, Math.ceil(step));

  const start = Math.ceil(min / normalizedStep) * normalizedStep;
  const end = Math.floor(max / normalizedStep) * normalizedStep;

  const count = Math.min(maxTicks, Math.floor((end - start) / normalizedStep) + 1);

  const ticks = Array.from({ length: count }, (_, i) => start + i * normalizedStep);

  if (min < start - normalizedStep / 2) {
    ticks.unshift(start - normalizedStep);
  }
  if (max > end + normalizedStep / 2) {
    ticks.push(end + normalizedStep);
  }

  return ticks;
};
