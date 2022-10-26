import React from 'react';
import s from './styles.module.less';

export type Data = {
  category: string;
  color: string;
  value: number;
}[];

interface Props {
  diameter: number;
  data: Data;
}

export default function Pie(props: Props) {
  const { diameter, data } = props;
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
      {data.map(({ value, color }, i) => {
        const percent = value / total;
        const arcLength = fullLength * percent;
        const offsetPercent = offsets[i] / total;
        return (
          <circle
            className={s.sector}
            key={i}
            r={halfRadius}
            cx={radius}
            cy={radius}
            transform={`rotate(${360 * offsetPercent}, ${radius}, ${radius})`}
            stroke={color}
            strokeWidth={radius}
            strokeDasharray={`${arcLength} ${fullLength - arcLength}`}
          >
            <title>{value}</title>
          </circle>
        );
      })}
      {data.map(({ value }, i) => {
        if (value === 0) {
          return <React.Fragment key={i}></React.Fragment>;
        }
        const offset = offsets[i];
        const angle = Math.PI * 2 * (value / total);
        const offsetAngle = Math.PI * 2 * (offset / total);
        const textX = radius + halfRadius * Math.cos(offsetAngle + angle / 2);
        const textY = radius + halfRadius * Math.sin(offsetAngle + angle / 2);
        const percent = value / total;
        return (
          <text className={s.label} key={i} x={textX} y={textY}>
            {(percent * 100).toFixed(2)}%
          </text>
        );
      })}
    </svg>
  );
}
