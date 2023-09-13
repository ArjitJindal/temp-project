import React from 'react';
import s from './index.module.less';
import { SanctionsDetails, SanctionsSearchHistory } from '@/apis';
import SanctionsTable from '@/components/SanctionsTable';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { SANCTIONS_SEARCH_LIST } from '@/utils/queries/keys';
import Tabs from '@/components/library/Tabs';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { success } from '@/utils/asyncResource';
import { humanizeConstant } from '@/utils/humanize';
import { P } from '@/components/ui/Typography';
import { map, QueryResult } from '@/utils/queries/types';

interface Props {
  details: SanctionsDetails[];
}

export default function ScreeningMatchList(props: Props) {
  const { details } = props;

  const results = useScreeningResults(details);

  return (
    <>
      <P variant="sml" bold className={s.title}>
        Sanctions match list
      </P>
      <AsyncResourceRenderer resource={results.data}>
        {(results) => {
          if (results.length === 0) {
            return <P variant="sml">No screening data available for alert</P>;
          }

          return (
            <Tabs
              type="card"
              items={results.map(({ details, response }) => {
                const queryResult = {
                  data: success({
                    items: response.response?.data ?? [],
                  }),
                  refetch: () => {
                    throw new Error(`Not implemented`);
                  },
                };
                return {
                  tab: getTabName(details),
                  key: details.name,
                  children: <SanctionsTable queryResult={queryResult} isEmbedded={true} />,
                };
              })}
            />
          );
        }}
      </AsyncResourceRenderer>
    </>
  );
}

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

function getTabName(details: SanctionsDetails) {
  let result = details.name;
  if (details.iban) {
    result += ` (IBAN: ${details.iban})`;
  }
  if (details.entityType) {
    result += ` (${humanizeConstant(details.entityType)})`;
  }
  return result;
}
