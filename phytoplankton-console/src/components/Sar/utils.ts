import { useApi } from '@/api';
import { REPORT_SCHEMAS } from '@/utils/queries/keys';
import { isSuccess } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { ReportType } from '@/apis';

export function useReportType(reportTypeId: string): ReportType | undefined {
  const api = useApi();
  const queryResult = useQuery(REPORT_SCHEMAS(), () => {
    return api.getReportTypes();
  });
  return isSuccess(queryResult.data)
    ? queryResult.data.value.data.find((v) => v.id === reportTypeId)
    : undefined;
}
