import {
  AllUsersTableItem as ApiAllUsersTableItem,
  UserApproval,
  BusinessUserTableItem as ApiBusinessUserTableItem,
  ConsumerUserTableItem as ApiConsumerUserTableItem,
} from '@/apis';

type WithProposals = {
  proposals?: UserApproval[];
};

export type AllUserTableItem = ApiAllUsersTableItem & WithProposals;
export type BusinessUserTableItem = ApiBusinessUserTableItem & WithProposals;
export type ConsumerUserTableItem = ApiConsumerUserTableItem & WithProposals;

export type TableListPagination = {
  total: number;
  pageSize: number;
  current: number;
  createdTimestamp?: [string, string];
  userId?: string;
};

export type TableListData = {
  list: UserTableItemExtended[];
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

// todo: it looks like these types are outdates, need to use API types in mocks
export type BusinessUsersListItem = any;
export type CustomerUsersListItem = any;
