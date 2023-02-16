import React from 'react';
import s from './index.module.less';

interface Props<TypeX, TypeY> {
  x: TypeX[];
  y: TypeY[];
  children: (x: TypeX, y: TypeY) => React.ReactNode;
}

export default function PropertyMatrix<TypeX, TypeY = unknown>(props: Props<TypeX, TypeY>) {
  const { x, y, children } = props;
  return (
    <div className={s.root} style={{ gridTemplateColumns: `repeat(${x.length + 1}, 1fr)` }}>
      <div></div>
      {x.map((xItem, i) => (
        <div className={s.label} key={i}>
          {stringify(xItem)}
        </div>
      ))}
      {y.map((yItem, i) => (
        <React.Fragment key={i}>
          <div className={s.label}>{stringify(yItem)}</div>
          {x.map((xItem, j) => (
            <React.Fragment key={j}>{children(xItem, yItem)}</React.Fragment>
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function stringify(value: unknown): string {
  if (value === null) {
    return 'null';
  }
  if (value === undefined) {
    return 'undefined';
  }
  if (typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return value.toString();
  }
  return JSON.stringify(value);
}
