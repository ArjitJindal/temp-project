import { RangeValue } from 'rc-picker/es/interface';
import { AuditLog, AuditLogType } from '@/apis';
import { SortOrder } from '@/components/ui/Table/types';
import { Dayjs } from '@/utils/dayjs';

export type TableSearchParams = Partial<{
  caseId: string;
  page: number;
  sort: [string, SortOrder][];
  createdTimestamp: RangeValue<Dayjs>;
  filterTypes: AuditLogType[];
  filterActionTakenBy: string[];
}>;

export type TableItem = AuditLog & {
  index: number;
};
