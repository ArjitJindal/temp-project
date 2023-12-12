import React, { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import s from './index.module.less';
import LatestOverviewTable from './LatestOverviewTable';
import SegmentedControl from '@/components/library/SegmentedControl';
import { Dayjs } from '@/utils/dayjs';
import { AllParams, CommonParams as TableCommonParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TEAM_STATS } from '@/utils/queries/keys';
import { AlertStatus, CaseStatus, DashboardLatestTeamStatsItem } from '@/apis';
import Widget from '@/components/library/Widget';
import { WidgetProps } from '@/components/library/Widget/types';

interface Params extends TableCommonParams {
  scope: 'CASES' | 'ALERTS';
  dateRange?: RangeValue<Dayjs>;
  caseStatus?: (CaseStatus | AlertStatus)[];
}

export default function LatestTeamPerformanceCard(props: WidgetProps) {
  const [params, setParams] = useState<AllParams<Params>>({
    ...DEFAULT_PARAMS_STATE,
    scope: 'CASES',
  });

  const api = useApi();

  const queryResult = useQuery(
    DASHBOARD_TEAM_STATS(params),
    async (): Promise<DashboardLatestTeamStatsItem[]> => {
      return await api.getDashboardLatestTeamStats({
        scope: params.scope,
      });
    },
  );

  return (
    <Widget {...props}>
      <div className={s.header}>
        <SegmentedControl<Params['scope']>
          active={params.scope}
          items={[
            {
              value: 'CASES',
              label: 'Cases',
            },
            {
              value: 'ALERTS',
              label: 'Alerts',
            },
          ]}
          onChange={(newActive) => {
            setParams((prevState) => ({ ...prevState, scope: newActive }));
          }}
        />
      </div>
      <LatestOverviewTable queryResult={queryResult} />
    </Widget>
  );
}
