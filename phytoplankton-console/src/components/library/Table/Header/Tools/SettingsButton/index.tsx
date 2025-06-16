import React, { useCallback, useEffect, useMemo, useState } from 'react';
import * as TanTable from '@tanstack/react-table';
import cn from 'clsx';
import { SPECIAL_COLUMN_IDS } from '../../../consts';
import s from './index.module.less';
import Popover from '@/components/ui/Popover';
import Settings3LineIcon from '@/components/ui/icons/Remix/system/settings-3-line.react.svg';
import More2Icon from '@/components/ui/icons/Remix/system/more-2-line.react.svg';
import { TableRow } from '@/components/library/Table/types';
import Checkbox from '@/components/library/Checkbox';
import PinIcon from '@/components/library/Table/Header/Tools/SettingsButton/PinIcon';
import { usePersistedSettingsContext } from '@/components/library/Table/internal/settings';
import Button from '@/components/library/Button';
import { StatePair } from '@/utils/state';

interface DndState {
  isDragging: boolean;
  columnId: string | null;
  newIndex: number | null;
}

interface Props<Item extends object> {
  table: TanTable.Table<TableRow<Item>>;
}

export default function SettingsButton<Item extends object>(props: Props<Item>) {
  const { table } = props;
  const extraTableContext = usePersistedSettingsContext();
  const [_, setColumnOrder] = extraTableContext.columnOrder;

  const dndStatePair = useState<DndState>({
    isDragging: false,
    columnId: null,
    newIndex: null,
  });

  useEffect(() => {
    const listener = () => {
      const [dndState, setDndState] = dndStatePair;
      const { newIndex, columnId } = dndState;
      if (newIndex != null && columnId != null) {
        setColumnOrder((order) => {
          const oldIndex = order.indexOf(columnId);
          const result = order.filter((x) => x !== columnId);
          result.splice(oldIndex < newIndex ? newIndex - 1 : newIndex, 0, columnId);
          return result;
        });
      }
      setDndState((prevState) => ({
        ...prevState,
        isDragging: false,
        columnId: null,
        newIndex: null,
      }));
    };
    window.addEventListener('mouseup', listener);
    return () => {
      window.removeEventListener('mouseup', listener);
    };
  }, [dndStatePair, setColumnOrder]);

  return (
    <div className={s.root}>
      <Popover
        trigger="click"
        placement="bottomLeft"
        content={
          <div className={s.content} data-cy="popup-content">
            <div className={s.headerGroupList}>
              <ColumnList table={table} columns={table.getAllColumns()} dndState={dndStatePair} />
            </div>
            <Button
              size="SMALL"
              onClick={() => {
                extraTableContext.reset();
              }}
            >
              Reset
            </Button>
          </div>
        }
      >
        <Settings3LineIcon
          role="button"
          aria-label="Settings button"
          aria-haspopup={true}
          className={s.icon}
        />
      </Popover>
    </div>
  );
}

function ColumnList<Item>(props: {
  table: TanTable.Table<TableRow<Item>>;
  columns: TanTable.Column<TableRow<Item>, unknown>[];
  deepLevel?: number;
  dndState: StatePair<DndState>;
}) {
  const { table, columns, deepLevel = 0, dndState } = props;
  const extraTableContext = usePersistedSettingsContext();
  const [columnOrder] = extraTableContext.columnOrder;
  const [columnOrderRestrictions] = extraTableContext.columnOrderRestrictions;
  const orderedColumns = useMemo(() => {
    const result = [
      ...columns.filter(
        (column) =>
          !SPECIAL_COLUMN_IDS.includes(column.id) && !columnOrderRestrictions.includes(column.id),
      ),
    ];
    result.sort((x, y) => columnOrder.indexOf(x.id) - columnOrder.indexOf(y.id));
    return result;
  }, [columns, columnOrder, columnOrderRestrictions]);
  return (
    <div className={s.columnList} style={{ paddingLeft: deepLevel * 24 }}>
      {orderedColumns.map((column, i) => {
        return (
          <React.Fragment key={column.id}>
            {i === 0 && deepLevel === 0 && <ColumnDropTarget newIndex={i} dndState={dndState} />}
            <Column deepLevel={deepLevel} column={column} dndState={dndState} />
            {column.columns.length > 0 && (
              <ColumnList
                table={table}
                columns={column.columns}
                deepLevel={deepLevel + 1}
                dndState={dndState}
              />
            )}
            {deepLevel === 0 && <ColumnDropTarget newIndex={i + 1} dndState={dndState} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ColumnDropTarget(props: { newIndex: number; dndState: StatePair<DndState> }) {
  const { newIndex } = props;

  const [dndState, setDndState] = props.dndState;

  const [isOver, setIsOver] = useState(false);

  const handleMouseEnter = useCallback(() => {
    setIsOver(true);
    setDndState((prevState) => ({ ...prevState, newIndex }));
  }, [setDndState, newIndex]);

  const handleMouseLeave = useCallback(() => {
    setIsOver(false);
  }, []);

  return (
    <div
      className={cn(
        s.columnDropPosition,
        dndState.isDragging && s.canDrop,
        dndState.isDragging && isOver && s.isOver,
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    />
  );
}

function Column<Item>(props: {
  column: TanTable.Column<TableRow<Item>>;
  deepLevel?: number;
  dndState: StatePair<DndState>;
}) {
  const { deepLevel, column } = props;
  const [dndState, setDndState] = props.dndState;

  return (
    <div
      className={cn(
        s.column,
        dndState.isDragging && dndState.columnId === column.id && s.isDragging,
      )}
    >
      <div className={s.columnLeft}>
        {deepLevel === 0 && (
          <div
            className={cn(s.dndIcon, column.getIsPinned() && s.isDisabled)}
            onMouseDown={() => {
              setDndState((prevState) => ({ ...prevState, isDragging: true, columnId: column.id }));
            }}
          >
            <More2Icon />
            <More2Icon />
          </div>
        )}
        <Checkbox
          testName={column.id}
          value={
            column.columns.length === 0
              ? column.getIsVisible()
              : column.columns.some((x) => x.getIsVisible())
          }
          onChange={(newValue) => {
            function toggleVisibilityRecursively(
              column: TanTable.Column<TableRow<Item>>,
              value: boolean | undefined,
            ) {
              if (column.columns.length === 0) {
                column.toggleVisibility(newValue);
              } else {
                for (const childColumn of column.columns) {
                  toggleVisibilityRecursively(childColumn, value);
                }
              }
            }
            toggleVisibilityRecursively(column, newValue);
          }}
        />
        {column.columnDef.header}
      </div>
      <div className={s.columnLeft}>
        {deepLevel === 0 && (
          <PinIcon
            value={column.getIsPinned()}
            onChange={(value) => {
              column.pin(value);
            }}
          />
        )}
      </div>
    </div>
  );
}
