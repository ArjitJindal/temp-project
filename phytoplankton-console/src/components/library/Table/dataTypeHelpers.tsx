import React from 'react';
import { humanizeStrings } from '@flagright/lib/utils/humanize';
import { ColumnDataType, FullColumnDataType } from './types';
import { UNKNOWN } from './standardDataTypes';

export function array<Value, Item = unknown>(
  sourceType: FullColumnDataType<Value, Item>,
): FullColumnDataType<Value[], Item> {
  const { stringify = UNKNOWN.stringify, renderEdit: _renderEdit, ...rest } = sourceType;
  return {
    ...rest,
    render: (values: Value[] | undefined, context) => {
      return (
        <>
          {values?.map((valueItem, i) => (
            <React.Fragment key={i}>
              {sourceType?.render?.(valueItem, {
                item: context.item,
                value: valueItem,
              })}
            </React.Fragment>
          ))}
        </>
      );
    },
    renderEdit: () => {
      throw new Error(`Not implemented for array types`);
    },
    stringify: (values: Value[] | undefined, item: Item) => {
      return humanizeStrings(values?.map((valueItem) => stringify(valueItem, item)) ?? []);
    },
    link: () => {
      return '';
    },
    export: undefined,
  };
}

export function callRender<T>(sourceType: ColumnDataType<T>, value: T): JSX.Element {
  const render = sourceType.render ?? UNKNOWN.render;
  return render(value, {
    value,
    item: null,
  });
}
