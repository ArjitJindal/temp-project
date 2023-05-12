import React, { useState } from 'react';
import s from './index.module.less';
import { Alert, ComplyAdvantageSearchHit, SanctionsSearchHistory } from '@/apis';
import { P } from '@/components/ui/Typography';
import SanctionsTable from '@/components/SanctionsTable';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { CommonParams, TableData } from '@/components/library/Table/types';
import { ALERT_ITEM_SANCTIONS_MATCH_LIST } from '@/utils/queries/keys';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';

interface Props {
  alert: Alert;
}

export default function ScreeningMatchList(props: Props) {
  const { alert } = props;

  const api = useApi();
  const queryResult = useQuery<TableData<ComplyAdvantageSearchHit>>(
    ALERT_ITEM_SANCTIONS_MATCH_LIST(alert.alertId ?? ''),
    async () => {
      const responses: SanctionsSearchHistory[] = await Promise.all(
        (alert.ruleHitMeta?.sanctionsDetails ?? []).map((x) =>
          api.getSanctionsSearchSearchId({ searchId: x.searchId }),
        ),
      );
      return {
        items: responses.flatMap((x) => x.response?.data ?? []),
      };
    },
  );

  const [params, setParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);

  return (
    <div>
      <P bold className={s.title}>
        Sanctions match list
      </P>
      {alert.alertId != null && (
        <SanctionsTable
          queryResult={queryResult}
          isEmbedded={true}
          params={params}
          onChangeParams={setParams}
        />
      )}
    </div>
  );
}
