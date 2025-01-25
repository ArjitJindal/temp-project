import { StringLike } from '@visx/scale';
import { ScaleBand, ScaleLinear } from 'd3-scale';
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

export const DEFAULT_PADDINGS: Paddings = { top: 16, right: 16, bottom: 32, left: 32 };

export const DEFAULT_X_AXIS_LABEL_ANGLE = -(Math.PI / 4);

export const calcAxisPaddings = (
  yLabels: string[],
  xLabels: string[],
  fontStyle: FontStyle = DEFAULT_AXIS_FONT_STYLE,
  xAngle = DEFAULT_X_AXIS_LABEL_ANGLE,
): {
  left: number;
  bottom: number;
} => {
  const maxYlength = yLabels.reduce((result, label) => {
    const length = measureTextSize(label, fontStyle).width;
    return Math.max(result, length);
  }, 0);

  const maxXlength = xLabels.reduce((result, label) => {
    const length = measureTextSize(label, fontStyle).width;
    return Math.max(result, length);
  }, 0);

  return {
    left: maxYlength,
    bottom: Math.max(0, maxXlength * -1 * Math.sin(xAngle)),
  };
};

type AbstractPlotScales<Category extends StringLike> = {
  yScale: ScaleLinear<number, number>;
  xScale: ScaleBand<Category>;
};

/**
  This function is used to adjust both scales and padding so that all the axis
  ticks would fit into the chart and scales would be appropriately fixed to new
  paddings
 */
export function adjustScalesAndPaddings<
  Category extends StringLike,
  Scales extends AbstractPlotScales<Category>,
>(
  initialPaddings: Paddings,
  getScales: (paddings: Paddings) => Scales,
): {
  scales: Scales;
  paddings: Paddings;
} {
  const initialScales = getScales(initialPaddings);

  // Calculate size required for axis labels
  const axisPaddings = calcAxisPaddings(
    initialScales.yScale.ticks().map(DEFAULT_NUMBER_FORMATTER),
    initialScales.xScale.domain().map((x) => x.toString()),
  );

  // Adjust left and bottom paddings by scales ticks
  const newPaddings = {
    ...initialPaddings,
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
