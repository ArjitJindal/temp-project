import { useMutation, UseMutationOptions } from '@tanstack/react-query';
import { useApi } from '@/api';
import { Report } from '@/apis';
import { REPORT_SCHEMAS_ALL, REPORTS_ITEM } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';

export const useReportTypes = () => {
  const api = useApi();
  return useQuery(REPORT_SCHEMAS_ALL(), () => {
    return api.getReportTypes({ allReportType: true });
  });
};

export const useReportDetails = (reportId: string) => {
  const api = useApi();
  return useQuery(
    REPORTS_ITEM(reportId),
    () => {
      return api.getReportsReportId({ reportId });
    },
    {
      enabled: !!reportId,
    },
  );
};

export const useSarDraft = ({
  alertIds,
  transactionIds,
  caseId,
  userId,
  options,
}: {
  alertIds?: string[];
  transactionIds?: string[];
  caseId?: string;
  userId?: string;
  options: UseMutationOptions<Report, unknown, string>;
}) => {
  const api = useApi();
  return useMutation(async (reportTypeId: string) => {
    return api.getReportsDraft({
      reportTypeId,
      alertIds,
      transactionIds,
      caseId,
      userId,
    });
  }, options);
};
