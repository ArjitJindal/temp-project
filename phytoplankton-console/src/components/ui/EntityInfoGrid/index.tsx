import { CSSProperties } from 'react';
import s from './index.module.less';

interface Props {
  columns?: number;
  children: React.ReactNode;
}

function EntityInfoGrid(props: Props) {
  const { children, columns = 1 } = props;
  return (
    <div className={s.root} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {children}
    </div>
  );
}

function EntityInfoGridCell(props: {
  rowSpan?: number;
  columnSpan?: number;
  children: React.ReactNode;
}) {
  const { rowSpan, columnSpan, children } = props;
  let style: CSSProperties | undefined = undefined;
  if (rowSpan) {
    style = {
      ...(style ?? {}),
      gridRow: `span ${rowSpan}`,
    };
  }
  if (columnSpan) {
    style = {
      ...(style ?? {}),
      gridColumn: `span ${columnSpan}`,
    };
  }
  return (
    <div className={s.cell} style={style}>
      {children}
    </div>
  );
}

export default {
  Root: EntityInfoGrid,
  Cell: EntityInfoGridCell,
};
