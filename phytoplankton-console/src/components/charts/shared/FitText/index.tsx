import React, { SVGAttributes } from 'react';
import { Size } from '@/components/charts/shared/helpers';
import { fitText, FontStyle } from '@/components/charts/shared/text';

export default function FitText(
  props: {
    children: string;
    rect: Size;
    fontStyle: FontStyle;
  } & Omit<SVGAttributes<SVGTextElement>, 'fontStyle'>,
) {
  const { children, fontStyle, rect, ...rest } = props;
  const newText = fitText(children, fontStyle, rect);
  return (
    <text
      {...rest}
      fontFamily={fontStyle.fontFamily}
      fontSize={fontStyle.fontSize}
      fontWeight={fontStyle.fontWeight}
    >
      {newText}
    </text>
  );
}
