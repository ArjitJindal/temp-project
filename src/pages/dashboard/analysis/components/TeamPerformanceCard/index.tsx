import React, { useState } from 'react';
import { Card } from 'antd';
import { RangeValue } from 'rc-picker/es/interface';
import AccountsStatisticsTable from './AccountsStatisticsTable';
import s from './index.module.less';
import { header } from '@/pages/dashboard/analysis/components/dashboardutils';
import SegmentedControl from '@/components/library/SegmentedControl';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import { AllParams, CommonParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_TEAM_STATS } from '@/utils/queries/keys';
import { CaseStatus, AlertStatus, DashboardTeamStatsItem } from '@/apis';
import { AutoFilter } from '@/components/library/Table/Header/Filters/AutoFilter';
import { humanizeConstant } from '@/utils/humanize';

interface Params extends CommonParams {
  scope: 'CASES' | 'ALERTS';
  dateRange: RangeValue<Dayjs>;
  caseStatus?: (CaseStatus | AlertStatus)[];
}

export default function TeamPerformanceCard() {
  const [params, setParams] = useState<AllParams<Params>>({
    ...DEFAULT_PARAMS_STATE,
    scope: 'CASES',
    dateRange: [dayjs().subtract(1, 'year'), dayjs()],
  });

  const api = useApi();

  const queryResult = useQuery(
    DASHBOARD_TEAM_STATS(params),
    async (): Promise<DashboardTeamStatsItem[]> => {
      const [start, end] = params.dateRange ?? [];
      let startTimestamp, endTimestamp;
      if (start != null && end != null) {
        startTimestamp = start.startOf('day').valueOf();
        endTimestamp = end.endOf('day').valueOf();
      }
      return await api.getDashboardTeamStats({
        scope: params.scope,
        startTimestamp,
        endTimestamp,
        caseStatus: params.caseStatus,
      });
    },
  );

  return (
    <Card
      title={header('Team overview')}
      bordered={false}
      headStyle={{ borderBottom: 'none' }}
      extra={
        <DatePicker.RangePicker
          value={params.dateRange}
          onChange={(value) => {
            setParams((prevState) => ({
              ...prevState,
              dateRange: value,
            }));
          }}
        />
      }
    >
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
        <AutoFilter
          filter={{
            key: 'caseStatus',
            kind: 'AUTO',
            title: params.scope === 'CASES' ? 'Case status' : 'Alert status',
            dataType: {
              kind: 'select',
              options: (['OPEN', 'CLOSED', 'REOPENED', 'ESCALATED'] as const).map(
                (caseStatus: CaseStatus) => ({
                  value: caseStatus,
                  label: humanizeConstant(caseStatus),
                }),
              ),
              mode: 'MULTIPLE',
              displayMode: 'select',
            },
          }}
          value={params.caseStatus}
          onChange={(value: unknown) => {
            const caseStatus = value as (CaseStatus | AlertStatus)[] | undefined;
            setParams((prevState) => ({ ...prevState, caseStatus }));
          }}
        />
      </div>
      <AccountsStatisticsTable queryResult={queryResult} />
    </Card>
  );
}
