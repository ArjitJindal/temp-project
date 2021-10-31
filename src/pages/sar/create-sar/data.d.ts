import { RuleTemplateTableListItem } from '../data.d';

export interface StepDataType {
  ruleDescription: string;
  ruleId: string;
  name: string;
  ruleAction: RuleAction;
  thresholdData: ThresholdDataType[];
}

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

export type TableListData = {
  list: RuleTemplateTableListItem[];
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
