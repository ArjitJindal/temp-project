import { TableParams } from '.';
import { AllParams } from '@/components/library/Table/types';
import { RawParsedQuery } from '@/utils/routing';
import { defaultQueryAdapter } from '@/components/library/Table/queryAdapter';
import { dayjs } from '@/utils/dayjs';
import { ReportStatus } from '@/apis';

export const sarQueryAdapter = {
  serializer: (params: AllParams<TableParams>): RawParsedQuery => {
    return {
      ...defaultQueryAdapter.serializer(params),
      filterReportId: params.id,
      filterCaseUserId: params.filterCaseUserId,
      filterJurisdiction: params.reportTypeId,
      filterCreatedBy: params.filterCreatedBy?.join(','),
      createdAtAfterTimestamp: params.createdAt
        ? String(params.createdAt?.map((t) => dayjs(t).valueOf())[0])
        : undefined,
      createdAtBeforeTimestamp: params.createdAt
        ? String(params.createdAt?.map((t) => dayjs(t).valueOf())[1])
        : undefined,
      filterStatus: params.filterStatus?.join(','),
      caseId: params.caseId,
    };
  },
  deserializer: (raw: RawParsedQuery): AllParams<TableParams> => {
    return {
      ...defaultQueryAdapter.deserializer(raw),
      id: raw.filterReportId,
      filterCaseUserId: raw.filterCaseUserId,
      reportTypeId: raw.filterJurisdiction,
      filterCreatedBy: raw.filterCreatedBy?.split(','),
      filterStatus: raw.filterStatus?.split(',') as ReportStatus[],
      createdAt:
        raw.createdAtAfterTimestamp && raw.createdAtBeforeTimestamp
          ? [
              dayjs(Number(raw.createdAtAfterTimestamp)).local().format(),
              dayjs(Number(raw.createdAtBeforeTimestamp)).local().format(),
            ]
          : undefined,
      caseId: raw.caseId,
    };
  },
};
