import { RangeValue } from 'rc-picker/es/interface';
import { AuditLog, AuditLogActionEnum, AuditLogType } from '@/apis';
import { SortOrder } from '@/components/library/Table/types';
import { Dayjs } from '@/utils/dayjs';

export type TableSearchParams = Partial<{
  caseId: string;
  page: number;
  sort: [string, SortOrder][];
  createdTimestamp: RangeValue<Dayjs>;
  filterTypes: AuditLogType[];
  filterActionTakenBy: string[];
  searchEntityId: string;
  filterActions: AuditLogActionEnum[];
}>;

export type TableItem = AuditLog & {
  index: number;
};
