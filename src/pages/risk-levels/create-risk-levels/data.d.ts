export interface StepDataType {
  parameterDescription: string;
  parameterId: string;
  name: string;
  parameterType: ParameterType;
  thresholdData: ThresholdDataType[];
}
//type this better lol
export const actionToColor = {
  range: 'blue',
  enumeration: 'green',
};

export type TableListParams = {
  status?: string;
  name?: string;
  desc?: string;
  key?: number;
  pageSize?: number;
  currentPage?: number;
  filter?: Record<string, any[]>;
  sorter?: Record<string, any>;
};

export type ParameterType = 'range' | 'enumeration';
export type ThresholdAllowedDataTypes = 'string' | 'list' | 'number';

export type ThresholdUpdateDataSourceType = {
  id: React.Key;
  parameter: string;
  defaultValue: any;
  children?: DataSourceType[];
};

export type TableListPagination = {
  total: number;
  pageSize: number;
  current: number;
};

export type ThresholdDataType = {
  parameter: string;
  type: ThresholdAllowedDataTypes;
  defaultValue: string;
};

export type ParameterTableListItemBase = {
  key: number;
  name: string;
  parameterDescription: string;
  parameterId: string;
  status: string;
  thresholdData: ThresholdDataType[];
};

export type ParameterTableListItem = ParameterTableListItemBase & {
  parameterType: ParameterType;
  isActionEditable: boolean;
};
