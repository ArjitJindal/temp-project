import React from 'react';
import cn from 'clsx';
import { Currency } from '@flagright/lib/constants';
import s from './styles.module.less';
import Popover from './Popover';
import { getLabelColor } from '@/components/ui/colors';

const LABEL_DISPLAY_THRESHOLD = 0.03;

export type Data = {
  category: string;
  color: string;
  value: number;
}[];

interface Props {
  diameter: number;
  data: Data;
  currency: Currency | null;
  highlighted: string | null;
  onChangeHighlighted: (category: string | null) => void;
}

export default function Pie(props: Props) {
  const { diameter, data, currency, highlighted, onChangeHighlighted } = props;
  const radius = diameter / 2;
  const halfRadius = radius / 2;
  const fullLength = Math.PI * 2 * halfRadius;

  const total = data.reduce((acc, { value }) => acc + value, 0);
  let nextOffset = 0;
  const offsets = data.map(({ value }) => {
    const offset = nextOffset;
    nextOffset += value;
    return offset;
  });

  return (
    <svg
      className={s.pie}
      height={diameter}
      width={diameter}
      viewBox={`0 0 ${diameter} ${diameter}`}
    >
      {data.map(({ category, value, color }, i) => {
        const percent = value / total;
        const arcLength = fullLength * percent;
        const offsetPercent = offsets[i] / total;
        const isHighlighted = highlighted === category;
        const isShadowed = highlighted != null && !isHighlighted;
        return (
          <g key={category} className={cn(s.animated, isShadowed && s.isShadowed)}>
            <circle
              className={cn(s.sector)}
              r={halfRadius}
              cx={radius}
              cy={radius}
              transform={`rotate(${360 * offsetPercent}, ${radius}, ${radius})`}
              stroke={color}
              strokeWidth={radius}
              strokeDasharray={`${arcLength} ${fullLength - arcLength}`}
              onMouseEnter={() => {
                onChangeHighlighted(category);
              }}
              onMouseLeave={() => {
                onChangeHighlighted(null);
              }}
            />
          </g>
        );
      })}
      {data.map(({ category, value, color }, i) => {
        if (value === 0) {
          return <React.Fragment key={i}></React.Fragment>;
        }
        const offset = offsets[i];
        const angle = Math.PI * 2 * (value / total);
        const offsetAngle = Math.PI * 2 * (offset / total);
        const labelRadius = radius * 0.7;
        const textX = radius + labelRadius * Math.cos(offsetAngle + angle / 2);
        const textY = radius + labelRadius * Math.sin(offsetAngle + angle / 2);
        const percent = value / total;
        const isHighlighted = highlighted === category;
        const isShadowed = highlighted != null && !isHighlighted;
        return (
          <React.Fragment key={category}>
            <Popover
              currency={currency}
              color={color}
              value={value}
              percent={percent}
              category={category}
              isVisible={isHighlighted}
            >
              <text className={cn(s.popoverAnchor)} x={textX} y={textY}>
                <>&nbsp;</>
              </text>
            </Popover>
            {percent >= LABEL_DISPLAY_THRESHOLD && (
              <text
                className={cn(s.label, s.animated, isShadowed && s.isShadowed)}
                fill={getLabelColor(color)}
                x={textX}
                y={textY}
              >
                {(percent * 100).toFixed(2)}%
              </text>
            )}
          </React.Fragment>
        );
      })}
    </svg>
  );
}
