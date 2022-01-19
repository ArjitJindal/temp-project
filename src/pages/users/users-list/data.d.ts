export type TableListItem = {
  key: number;
  disabled?: boolean;
  transactionId: string;
  name: string;
  rulesHit: number;
  amount: number;
  sendingCurrency: string;
  receivingCurrency: string;
  originCountry: string;
  destinationCountry: string;
  paymentMethod: string;
  payoutMethod: string;
  tags: object[];
  status: string;
  updatedAt: Date;
  createdAt: Date;
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
