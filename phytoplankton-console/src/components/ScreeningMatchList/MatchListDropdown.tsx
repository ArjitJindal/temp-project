import { useState } from 'react';
import AsyncResourceRenderer from '../utils/AsyncResourceRenderer';
import SanctionsTable from '../SanctionsTable';
import { P } from '../ui/Typography';
import Select, { Option } from '../library/Select';
import { SanctionsDetails, SanctionsSearchHistory } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { SANCTIONS_SEARCH_LIST } from '@/utils/queries/keys';
import { map, QueryResult } from '@/utils/queries/types';
import { useApi } from '@/api';
import { success } from '@/utils/asyncResource';
import { humanizeConstant } from '@/utils/humanize';

interface Props {
  details: SanctionsDetails[];
}

export const MatchListDropdown = (props: Props) => {
  const { details } = props;
  const results = useScreeningResults(details);
  const [option, setOption] = useState<string | undefined>();
  return (
    <AsyncResourceRenderer resource={results.data}>
      {(results) => {
        if (results.length === 0) {
          return (
            <P variant="m" fontWeight="normal">
              No screening data available for alert
            </P>
          );
        }
        const options: Option<string>[] = results.map((sanction, i) => {
          return {
            label: getOptionName(sanction.details),
            value: sanction.details.name,
            isDefault: i == 0,
          };
        });
        const queryResult = getQueryResult(results, option ?? options[0].value);
        return (
          <>
            <Select<string>
              mode={'SINGLE'}
              options={options}
              onChange={(value) => {
                setOption(value ?? '');
              }}
              placeholder="Select sanctions name"
            />
            {queryResult ? <SanctionsTable queryResult={queryResult} isEmbedded={true} /> : <></>}
          </>
        );
      }}
    </AsyncResourceRenderer>
  );
};

interface ScreeningResult {
  details: SanctionsDetails;
  response: SanctionsSearchHistory;
}

function useScreeningResults(sanctionDetails: SanctionsDetails[]): QueryResult<ScreeningResult[]> {
  const api = useApi();
  const searchIds = sanctionDetails.map((sanctionsDetails) => sanctionsDetails.searchId);
  const queryResult = useQuery(SANCTIONS_SEARCH_LIST(searchIds), async () => {
    return await Promise.all(
      searchIds.map(async (searchId) => {
        const response = await api.getSanctionsSearchSearchId({
          searchId: searchId,
        });
        return {
          searchId: searchId,
          response: response,
        };
      }),
    );
  });

  return map(queryResult, (results): ScreeningResult[] => {
    return results.map((result): ScreeningResult => {
      const details = sanctionDetails.find((x) => x.searchId === result.searchId);
      if (details == null) {
        throw new Error(`Unable to find corresponding object`);
      }
      return {
        details: details,
        response: result.response,
      };
    });
  });
}

function getOptionName(details: SanctionsDetails) {
  let result = details.name;
  if (details.iban) {
    result += ` (IBAN: ${details.iban})`;
  }
  if (details.entityType) {
    result += ` (${humanizeConstant(details.entityType)})`;
  }
  return result;
}

function getQueryResult(results: ScreeningResult[], option: string) {
  const result = results
    .filter(({ details }) => details.name === option)
    .map(({ response }) => {
      return {
        data: success({
          items: response.response?.data ?? [],
        }),
        refetch: () => {
          throw new Error(`Not implemented`);
        },
        isLoading: false,
      };
    });
  return result?.length ? result[0] : undefined;
}
