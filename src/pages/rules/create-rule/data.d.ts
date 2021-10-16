export interface StepDataType {
  ruleDescription: string;
  ruleId: string;
  name: string;
}

export type RuleAction = 'flag' | 'block' | 'allow';

export type ThresholdAllowedDataTypes = 'string' | 'list' | 'number';

export type ThresholdDataType = {
  parameter: string;
  type: ThresholdAllowedDataTypes;
  defaultValue: string;
};

export type CurrentTypes = 'base' | 'confirm' | 'result';

export type TableListItem = {
  key: number;
  disabled?: boolean;
  href: string;
  name: string;
  ruleDescription: string;
  ruleId: string;
  status: string;
  thresholdData: ThresholdDataType[];
  defaultAction: RuleAction;
  isActionEditable: boolean;
};

export type TableListPagination = {
  total: number;
  pageSize: number;
  current: number;
};

export type TableListData = {
  list: TableListItem[];
  pagination: Partial<TableListPagination>;
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
