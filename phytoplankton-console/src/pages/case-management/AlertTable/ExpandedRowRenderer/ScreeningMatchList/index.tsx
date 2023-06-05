import React, { useState } from 'react';
import { Alert, SanctionsDetails, SanctionsSearchHistory } from '@/apis';
import SanctionsTable from '@/components/SanctionsTable';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { CommonParams } from '@/components/library/Table/types';
import { ALERT_ITEM_SANCTIONS_MATCH_LIST } from '@/utils/queries/keys';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import Tabs from '@/components/library/Tabs';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { success } from '@/utils/asyncResource';
import { humanizeConstant } from '@/utils/humanize';
import { P } from '@/components/ui/Typography';

interface Props {
  alert: Alert;
}

interface ScreeningResult {
  details: SanctionsDetails;
  response: SanctionsSearchHistory;
}

export default function ScreeningMatchList(props: Props) {
  const { alert } = props;

  const api = useApi();
  const queryResult = useQuery<ScreeningResult[]>(
    ALERT_ITEM_SANCTIONS_MATCH_LIST(alert.alertId ?? ''),
    async () => {
      const responses: ScreeningResult[] = await Promise.all(
        (alert.ruleHitMeta?.sanctionsDetails ?? []).map(async (sanctionsDetails) => {
          const response = await api.getSanctionsSearchSearchId({
            searchId: sanctionsDetails.searchId,
          });
          return {
            details: sanctionsDetails,
            response: response,
          };
        }),
      );
      return responses;
    },
  );

  const [params, setParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(results) => {
        if (results.length === 0) {
          return <P variant="sml">No screening data available for alert</P>;
        }

        return (
          <Tabs
            items={results.map(({ details, response }) => {
              return {
                tab: getTabName(details),
                key: details.name,
                children: (
                  <SanctionsTable
                    queryResult={{
                      data: success({
                        items: response.response?.data ?? [],
                      }),
                      refetch: () => {
                        throw new Error(`Not implemented`);
                      },
                    }}
                    isEmbedded={true}
                    params={params}
                    onChangeParams={setParams}
                  />
                ),
              };
            })}
          />
        );
      }}
    </AsyncResourceRenderer>
  );
}

function getTabName(details: SanctionsDetails) {
  let result = details.name;
  if (details.entityType != null) {
    result += ` (${humanizeConstant(details.entityType)})`;
  }
  return result;
}
