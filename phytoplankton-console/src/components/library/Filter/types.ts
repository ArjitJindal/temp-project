import React from 'react';
import { Option } from '@/components/library/Select';

export interface BaseFilter {
  key: string;
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  showFilterByDefault?: boolean;
  pinFilterToLeft?: boolean;
}

export type ExtraFilterRendererProps<Params extends object | unknown> = {
  params: Params;
  setParams: (cb: (oldState: Params) => Params) => void;
  onUpdateFilterClose?: (status: boolean) => void;
  readOnly?: boolean;
};
export type ExtraFilterRenderer<Params extends object | unknown> = (
  props: ExtraFilterRendererProps<Params>,
) => React.ReactNode;

export interface ExtraFilterProps<Params extends object | unknown> extends BaseFilter {
  kind?: 'EXTRA';
  renderer: ExtraFilterRenderer<Params> | AutoFilterDataType | undefined;
}

type WithSharedAutoFilterProps<T> = T & {
  autoWidth?: boolean;
  allowClear?: boolean;
  clearNotAllowedReason?: string;
};

export type AutoFilterDataType =
  | WithSharedAutoFilterProps<{ kind: 'string' }>
  | WithSharedAutoFilterProps<{ kind: 'number'; max?: number; min?: number; step?: number }>
  | WithSharedAutoFilterProps<{ kind: 'dateRange' }>
  | WithSharedAutoFilterProps<{ kind: 'dateTimeRange' }>
  | WithSharedAutoFilterProps<{
      kind: 'select';
      options: Option<string>[];
      mode: 'SINGLE' | 'MULTIPLE' | 'TAGS';
      displayMode: 'select' | 'list';
    }>;

export interface AutoFilterProps extends BaseFilter {
  kind: 'AUTO';
  dataType: AutoFilterDataType;
}

export function isExtraFilter<Params extends object | unknown>(
  filter: FilterProps<Params>,
): filter is ExtraFilterProps<Params> {
  return filter.kind == null || filter.kind === 'EXTRA';
}

export function isAutoFilter<Params extends object | unknown>(
  filter: FilterProps<Params>,
): filter is AutoFilterProps {
  return filter.kind === 'AUTO';
}

export type FilterProps<Params extends object | unknown> =
  | AutoFilterProps
  | ExtraFilterProps<Params>;
