import React, { useState } from 'react';
import s from './index.module.less';

interface Props<TypeX, TypeY> {
  x?: readonly TypeX[];
  y?: readonly TypeY[];
  xLabel?: string;
  yLabel?: string;
  children: (x: TypeX, y: TypeY) => React.ReactNode;
}

const STRETCH_MODES = ['start', 'center', 'unset'];

export default function PropertyMatrix<TypeX, TypeY = unknown>(props: Props<TypeX, TypeY>) {
  const { x, y, xLabel, yLabel, children } = props;
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
      {(y ?? ['-']).map((yItem, i) => (
        <React.Fragment key={i}>
          <div className={s.label}>{stringify(yItem, yLabel)}</div>
          {(x ?? [undefined]).map((xItem, j) => (
            <React.Fragment key={j}>{children(xItem as any, yItem as any)}</React.Fragment>
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
