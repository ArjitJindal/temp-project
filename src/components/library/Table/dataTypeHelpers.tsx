import React from 'react';
import { ColumnDataType, FullColumnDataType } from './types';
import { UNKNOWN } from './standardDataTypes';
import { init } from '@/utils/asyncResource';
import { humanizeStrings } from '@/utils/humanize';

export function array<Value, Item = unknown>(
  sourceType: FullColumnDataType<Value, Item>,
): FullColumnDataType<Value[], Item> {
  const { stringify = UNKNOWN.stringify, ...rest } = sourceType;
  return {
    ...rest,
    render: (values: Value[] | undefined, editing, item: Item) => (
      <>
        {values?.map((valueItem, i) => (
          <React.Fragment key={i}>
            {sourceType?.render?.(
              valueItem,
              {
                isSupported: false,
                onChange: () => {},
                statusRes: init(),
              },
              item,
            )}
          </React.Fragment>
        ))}
      </>
    ),
    stringify: (values: Value[] | undefined, item: Item) => {
      return humanizeStrings(values?.map((valueItem) => stringify(valueItem, item)) ?? []);
    },
  };
}

export function callRender<T>(sourceType: ColumnDataType<T>, value: T): JSX.Element {
  const render = sourceType.render ?? UNKNOWN.render;
  return render(value, { isSupported: false, onChange: () => {}, statusRes: init() }, null);
}
