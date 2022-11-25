import { AuditLog, AuditLogType } from '@/apis';
import { SortOrder } from '@/components/ui/Table/types';

export type TableSearchParams = Partial<{
  caseId: string;
  page: number;
  sort: [string, SortOrder][];
  createdTimestamp: string[];
  filterTypes: AuditLogType[];
}>;

export type TableItem = AuditLog & {
  index: number;
};
