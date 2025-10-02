import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { REPORT_SCHEMAS, REPORT_SCHEMAS_ALL, CASES_ITEM } from '@/utils/queries/keys';
import { Case, ReportType, CountryCode } from '@/apis';
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

export function useCaseItem(caseId: string, options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery<Case>(
    CASES_ITEM(caseId),
    async () => {
      return await api.getCase({ caseId });
    },
    options,
  );
}
