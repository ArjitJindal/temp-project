import React, { useEffect, useMemo } from 'react';
import { getEmptyImage, HTML5Backend } from 'react-dnd-html5-backend';
import { Popover } from 'antd';
import * as TanTable from '@tanstack/react-table';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import cn from 'clsx';
import { SPECIAL_COLUMN_IDS } from '../../../consts';
import s from './index.module.less';
import Settings3LineIcon from '@/components/ui/icons/Remix/system/settings-3-line.react.svg';
import More2Icon from '@/components/ui/icons/Remix/system/more-2-line.react.svg';
import { TableRow } from '@/components/library/Table/types';
import Checkbox from '@/components/library/Checkbox';
import PinIcon from '@/components/library/Table/Header/Tools/SettingsButton/PinIcon';
import { usePersistedSettingsContext } from '@/components/library/Table/internal/settings';
import Button from '@/components/library/Button';

const DND_TYPE = 'COLUMN';

interface DndInfo {
  columnId: string;
}

interface Props<Item extends object> {
  table: TanTable.Table<TableRow<Item>>;
}

export default function SettingsButton<Item extends object>(props: Props<Item>) {
  const { table } = props;
  const extraTableContext = usePersistedSettingsContext();

  return (
    <div className={s.root}>
      <Popover
        zIndex={1}
        overlayClassName={'overlayClassName'}
        trigger="click"
        placement="bottomLeft"
        content={
          <DndProvider backend={HTML5Backend}>
            <div className={s.content}>
              <div className={s.headerGroupList}>
                <ColumnList table={table} columns={table.getAllColumns()} />
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
          </DndProvider>
        }
      >
        <Settings3LineIcon className={s.icon} />
      </Popover>
    </div>
  );
}

function ColumnList<Item>(props: {
  table: TanTable.Table<TableRow<Item>>;
  columns: TanTable.Column<TableRow<Item>, unknown>[];
  deepLevel?: number;
}) {
  const { table, columns, deepLevel = 0 } = props;
  const extraTableContext = usePersistedSettingsContext();
  const [columnOrder] = extraTableContext.columnOrder;

  const orderedColumns = useMemo(() => {
    const result = [...columns.filter((column) => !SPECIAL_COLUMN_IDS.includes(column.id))];
    result.sort((x, y) => columnOrder.indexOf(x.id) - columnOrder.indexOf(y.id));
    return result;
  }, [columns, columnOrder]);

  return (
    <div className={s.columnList} style={{ paddingLeft: deepLevel * 20 }}>
      {orderedColumns.map((column, i) => (
        <React.Fragment key={column.id}>
          {i === 0 && deepLevel === 0 && <ColumnDropTarget newIndex={i} />}
          <Column deepLevel={deepLevel} column={column} />
          {column.columns.length > 0 && (
            <ColumnList table={table} columns={column.columns} deepLevel={deepLevel + 1} />
          )}
          {deepLevel === 0 && <ColumnDropTarget newIndex={i + 1} />}
        </React.Fragment>
      ))}
    </div>
  );
}

function ColumnDropTarget(props: { newIndex: number }) {
  const { newIndex } = props;
  const extraTableContext = usePersistedSettingsContext();
  const [_, setColumnOrder] = extraTableContext.columnOrder;

  const [collectedProps, dropRef] = useDrop<
    DndInfo,
    unknown,
    {
      canDrop: boolean;
      isOver: boolean;
    }
  >(
    () => ({
      accept: DND_TYPE,
      drop: (item) => {
        setColumnOrder((order) => {
          const result = order.filter((x) => x !== item.columnId);
          result.splice(newIndex, 0, item.columnId);
          return result;
        });
      },
      collect: (monitor) => ({
        canDrop: monitor.canDrop(),
        isOver: monitor.isOver(),
      }),
    }),
    [newIndex],
  );

  return (
    <div
      ref={dropRef}
      className={cn(
        s.columnDropPosition,
        collectedProps.isOver && s.isOver,
        collectedProps.canDrop && s.canDrop,
      )}
    />
  );
}

function Column<Item>(props: { column: TanTable.Column<TableRow<Item>>; deepLevel?: number }) {
  const { deepLevel, column } = props;

  const [{ isDragging }, dragRef, previewRef] = useDrag<
    DndInfo,
    unknown,
    {
      isDragging: boolean;
    }
  >(
    () => ({
      type: DND_TYPE,
      options: {
        dropEffect: 'move',
      },
      previewOptions: {
        captureDraggingState: true,
      },
      item: { columnId: column.id },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    }),
    [],
  );

  // this useEffect hides the default preview
  useEffect(() => {
    previewRef(getEmptyImage(), { captureDraggingState: true });
  }, [previewRef]);

  return (
    <div className={cn(s.column, isDragging && s.isDragging)}>
      <div className={s.columnLeft}>
        {deepLevel === 0 && (
          <div className={cn(s.dndIcon, column.getIsPinned() && s.isDisabled)} ref={dragRef}>
            <More2Icon />
            <More2Icon />
          </div>
        )}
        <Checkbox
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
