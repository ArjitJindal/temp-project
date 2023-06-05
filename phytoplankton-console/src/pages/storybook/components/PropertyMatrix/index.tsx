import React from 'react';
import s from './index.module.less';

interface Props<TypeX, TypeY> {
  x?: TypeX[];
  y?: TypeY[];
  xLabel?: string;
  yLabel?: string;
  children: (x: TypeX, y: TypeY) => React.ReactNode;
}

export default function PropertyMatrix<TypeX, TypeY = unknown>(props: Props<TypeX, TypeY>) {
  const { x, y, xLabel, yLabel, children } = props;
  return (
    <div
      className={s.root}
      style={{
        gridTemplateColumns: y
          ? `min-content repeat(${x?.length ?? 1}, 1fr)`
          : `repeat(${x?.length ?? 1}, 1fr)`,
      }}
    >
      {x && y && <div></div>}
      {x &&
        x.map((xItem, i) => (
          <div className={s.label} key={i}>
            {stringify(xItem, xLabel)}
          </div>
        ))}
      {(y ?? [undefined]).map((yItem, i) => (
        <React.Fragment key={i}>
          {y && <div className={s.label}>{stringify(yItem, yLabel)}</div>}
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
