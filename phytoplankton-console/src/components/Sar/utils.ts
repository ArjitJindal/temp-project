import { useApi } from '@/api';
import { REPORT_SCHEMAS, REPORT_SCHEMAS_ALL } from '@/utils/queries/keys';
import { isSuccess } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { CountryCode, ReportType } from '@/apis';

export interface SARReportCountry {
  country: string;
  countryCode: CountryCode;
}

export function useSARReportCountries(allReportType?: boolean): SARReportCountry[] {
  const api = useApi();
  const queryKey = allReportType ? REPORT_SCHEMAS_ALL() : REPORT_SCHEMAS();
  const queryResult = useQuery(queryKey, () => {
    return api.getReportTypes({ allReportType: allReportType ?? false });
  });
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

export function useReportType(reportTypeId: string): ReportType | undefined {
  const api = useApi();
  const queryResult = useQuery(REPORT_SCHEMAS(), () => {
    return api.getReportTypes();
  });
  return isSuccess(queryResult.data)
    ? queryResult.data.value.data.find((v) => v.id === reportTypeId)
    : undefined;
}
