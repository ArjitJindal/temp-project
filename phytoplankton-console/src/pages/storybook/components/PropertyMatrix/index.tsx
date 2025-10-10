import React, { useState } from 'react';
import s from './index.module.less';

interface Props<TypeX, TypeY, TypeY2> {
  x?: readonly TypeX[];
  y?: readonly TypeY[];
  y2?: readonly TypeY2[];
  xLabel?: string;
  yLabel?: string;
  y2Label?: string;
  children: (x: TypeX, y: TypeY, y2: TypeY2) => React.ReactNode;
}

const STRETCH_MODES = ['start', 'center', 'unset'];

export default function PropertyMatrix<TypeX, TypeY = unknown, TypeY2 = unknown>(
  props: Props<TypeX, TypeY, TypeY2>,
) {
  const { x, y, y2, xLabel, yLabel, y2Label, children } = props;
  const [stretchModeIndex, setStretchModeIndex] = useState(0);
  return (
    <div
      className={s.root}
      style={{
        gridTemplateColumns: `min-content repeat(${x?.length ?? 1}, 1fr)`,
        justifyItems: STRETCH_MODES[stretchModeIndex],
      }}
    >
      <div className={s.corner}>
        <div
          className={s.stretchButton}
          onClick={() => {
            setStretchModeIndex((prevState) => (prevState + 1) % STRETCH_MODES.length);
          }}
        >
          S
        </div>
      </div>
      {(x ?? ['-']).map((xItem, i) => (
        <div className={s.label} key={i}>
          {stringify(xItem, xLabel)}
        </div>
      ))}
      {(y ?? ['-']).map((yItem, k) => (
        <React.Fragment key={k}>
          {(y2 ?? ['-']).map((y2Item, i) => (
            <React.Fragment key={i}>
              <div className={s.label}>
                {stringify(yItem, yLabel)}
                {y2Label && `,${stringify(y2Item, y2Label)}`}
              </div>
              {(x ?? [undefined]).map((xItem, j) => (
                <React.Fragment key={j}>
                  {children(xItem as any, yItem as any, y2Item as any)}
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function stringify(value: unknown, label?: string): string {
  let result;
  if (value === null) {
    result = 'null';
  } else if (value === undefined) {
    result = 'undefined';
  } else if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    result = value.toString();
  } else {
    result = JSON.stringify(value);
  }
  return label ? `${label}=${result}` : result;
}
