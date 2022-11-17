import { AuditLog } from '@/apis';
import { SortOrder } from '@/components/ui/Table/types';

export type TableSearchParams = Partial<{
  caseId: string;
  page: number;
  sort: [string, SortOrder][];
  timestamp: string[];
  filterTypes: Array<string>;
}>;

export type TableItem = AuditLog & {
  index: number;
};
