import { memoize } from 'lodash';
import { Size } from './helpers';
import { FIGMA_VARS_PRIMITIVES_TYPOGRAPHY_FONT_FAMILY_BODY } from '@/components/ui/figma-vars';

export type FontStyle = {
  fontSize: number;
  fontWeight: number;
  fontFamily: string;
};

export const DEFAULT_FONT_STYLE: FontStyle = {
  fontSize: 12,
  fontWeight: 600,
  fontFamily: FIGMA_VARS_PRIMITIVES_TYPOGRAPHY_FONT_FAMILY_BODY,
};

export const DEFAULT_AXIS_FONT_STYLE: FontStyle = {
  fontSize: 12,
  fontWeight: 400,
  fontFamily: FIGMA_VARS_PRIMITIVES_TYPOGRAPHY_FONT_FAMILY_BODY,
};

let ctx: CanvasRenderingContext2D | null = null;

export const measureTextSize = memoize(
  (text: string, fontStyle: FontStyle) => {
    if (ctx == null) {
      const canvas = document.createElement('canvas');
      ctx = canvas.getContext('2d');
    }
    if (!ctx) {
      return {
        width: 0,
        height: 0,
      };
    }
    const { fontSize, fontWeight } = fontStyle;
    ctx.font = `${fontWeight} ${fontSize}px ${fontStyle.fontFamily}`;
    const textMetrics = ctx.measureText(text);
    return {
      width: textMetrics.width,
      height: textMetrics.actualBoundingBoxAscent + textMetrics.actualBoundingBoxDescent,
    };
  },
  (text, fontStyle) => JSON.stringify([text, fontStyle]),
);

export function fitText(text: string, fontStyle: FontStyle, rect: Size): string {
  let result = '';
  const words = text.split(/\s+/);
  for (const word of words) {
    const newResult = result === '' ? word : `${result} ${word}`;
    const size = measureTextSize(newResult + '...', fontStyle);
    const isFit = size.width <= rect.width && size.height <= rect.height;
    if (isFit) {
      result = newResult;
    } else {
      const newResult = `${result}...`;
      const size = measureTextSize(newResult + '...', fontStyle);
      const isFit = size.width <= rect.width && size.height <= rect.height;
      if (isFit) {
        result = newResult;
        break;
      }
      break;
    }
  }
  return result;
}
