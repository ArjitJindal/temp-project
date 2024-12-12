import { CSSProperties } from 'react';
import s from './index.module.less';

interface InfoGridProps {
  columns?: number;
  children: React.ReactNode;
}

interface InfoGridCellProps {
  rowSpan?: number;
  columnSpan?: number;
  maxHeight?: number;
  children: React.ReactNode;
}

interface InfoGridColumnGroupProps {
  rowSpan?: number;
  columnSpan?: number;
  maxHeight?: number;
  childrens: React.ReactNode[];
}

function EntityInfoGrid(props: InfoGridProps) {
  const { children, columns = 1 } = props;
  return (
    <div className={s.root} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {children}
    </div>
  );
}

function EntityInfoGridCell(props: InfoGridCellProps) {
  const { rowSpan, columnSpan, children, maxHeight } = props;
  let style: CSSProperties | undefined = undefined;
  const elementStyle: CSSProperties | undefined = {
    overflow: 'auto',
    flexGrow: 1,
  };
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
  if (maxHeight) {
    style = {
      ...(style ?? {}),
      maxHeight: `${maxHeight}px`,
      overflow: 'auto',
    };
  }
  return (
    <div className={s.cell} style={style}>
      <div style={elementStyle}>{children}</div>
    </div>
  );
}
function EntityInfoColumnGroup(props: InfoGridColumnGroupProps) {
  const { rowSpan, columnSpan, childrens, maxHeight } = props;
  let style: CSSProperties | undefined = undefined;
  let elementStyle: CSSProperties | undefined = {
    overflow: 'auto',
    flexGrow: 1,
  };
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
  if (maxHeight) {
    style = {
      ...(style ?? {}),
      maxHeight: `${maxHeight}px`,
    };
    elementStyle = {
      ...(elementStyle ?? {}),
      maxHeight: `${maxHeight / childrens.length}px`,
    };
  }
  return (
    <div className={s.columnGroup} style={style}>
      {childrens.map((child, index) => (
        <div className={s.columnElement} key={index} style={elementStyle}>
          {child}
        </div>
      ))}
    </div>
  );
}

export default {
  Root: EntityInfoGrid,
  Cell: EntityInfoGridCell,
  ColumnGroup: EntityInfoColumnGroup,
};
