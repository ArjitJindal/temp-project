export type NetworkAnalysisTableListItem = {
  key: number;
  disabled?: boolean;
  transactionIds: string[];
  name: string[];
  tags: object[];
};

export type NetworkAnalysisTableListPagination = {
  total: number;
  pageSize: number;
  current: number;
};

export type NetworkAnalysisTableListData = {
  list: NetworkAnalysisTableListItem[];
  pagination: Partial<NetworkAnalysisTableListPagination>;
};

export type NetworkAnalysisTableListParams = {
  status?: string;
  name?: string;
  desc?: string;
  key?: number;
  pageSize?: number;
  currentPage?: number;
  filter?: Record<string, any[]>;
  sorter?: Record<string, any>;
};
