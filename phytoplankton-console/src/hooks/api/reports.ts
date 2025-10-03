import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { REPORT_SCHEMAS, REPORT_SCHEMAS_ALL } from '@/utils/queries/keys';
import { ReportType, CountryCode } from '@/apis';
import { isSuccess } from '@/utils/asyncResource';

export function useReportTypesAll(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery(
    REPORT_SCHEMAS_ALL(),
    () => {
      return api.getReportTypes({ allReportType: true });
    },
    options,
  );
}

export function useReportTypes(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery(REPORT_SCHEMAS(), () => api.getReportTypes(), options);
}

export function useReportType(reportTypeId: string): ReportType | undefined {
  const queryResult = useReportTypes();
  return isSuccess(queryResult.data)
    ? queryResult.data.value.data.find((v) => v.id === reportTypeId)
    : undefined;
}

export interface SARReportCountry {
  country: string;
  countryCode: CountryCode;
}

export function useSARReportCountries(allReportType?: boolean): SARReportCountry[] {
  const all = useReportTypesAll({ enabled: allReportType === true });
  const base = useReportTypes({ enabled: !allReportType });
  const queryResult = allReportType ? all : base;
  if (isSuccess(queryResult.data)) {
    const countries: { [countryCode: string]: SARReportCountry } =
      queryResult.data.value.data.reduce((acc, curr) => {
        acc[curr.countryCode] = {
          country: curr.country,
          countryCode: curr.countryCode,
        };
        return acc;
      }, {} as { [countryCode: string]: SARReportCountry });

    return Object.keys(countries).map((key) => countries[key]);
  }

  return [];
}

export function useReportsDraftMutation() {
  const api = useApi();
  return useMutation(
    (vars: {
      reportTypeId: string;
      params:
        | { userId: string; alertIds?: string[]; transactionIds?: string[] }
        | { caseId: string; alertIds?: string[]; transactionIds?: string[] };
    }) =>
      api.getReportsDraft({
        ...(vars.params as any),
        reportTypeId: vars.reportTypeId,
      }),
  );
}

// useCase moved to hooks/api/cases.ts
