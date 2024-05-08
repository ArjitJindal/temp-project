import { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { OverviewCard } from '../../widgets/OverviewCard';
import s from './styles.module.less';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_STATS_QA_OVERVIEW } from '@/utils/queries/keys';
import { dayjs, Dayjs } from '@/utils/dayjs';
import WidgetBase from '@/components/library/Widget/WidgetBase';
import DatePicker from '@/components/ui/DatePicker';
import { useApi } from '@/api';
import { WidgetProps } from '@/components/library/Widget/types';
import { map } from '@/utils/asyncResource';

interface Props extends WidgetProps {}

export default function QaOverview(props: Props) {
  const [dateRange, setDateRange] = useState<RangeValue<Dayjs>>([
    dayjs().subtract(1, 'month'),
    dayjs(),
  ]);
  const api = useApi();
  const queryResult = useQuery(DASHBOARD_STATS_QA_OVERVIEW(dateRange), async () => {
    let startTimestamp = dayjs().subtract(1, 'month').valueOf();
    let endTimestamp = Date.now();
    const [start, end] = dateRange ?? [];
    if (start != null && end != null) {
      startTimestamp = start.startOf('day').valueOf();
      endTimestamp = end.endOf('day').valueOf();
    }
    return await api.getDashboardStatsQaOverview({ startTimestamp, endTimestamp });
  });
  const dataRes = map(
    queryResult.data,
    ({ totalAlertsForQa, totalQaFailedAlerts, totalQaPassedAlerts }) => {
      const totalQadAlerts = totalQaFailedAlerts + totalQaPassedAlerts;
      const avgQaEvaluationScore = totalQadAlerts ? (totalQadAlerts / totalAlertsForQa) * 100 : 0;
      const qaPassedPercentage = totalQadAlerts ? (totalQaPassedAlerts / totalQadAlerts) * 100 : 0;
      const qaFailedPercentage = totalQadAlerts ? (totalQaFailedAlerts / totalQadAlerts) * 100 : 0;
      return {
        avgQaEvaluationScore,
        qaPassedPercentage,
        qaFailedPercentage,
      };
    },
  );
  return (
    <WidgetBase {...props}>
      <div className={s.root}>
        <div className={s.header}>
          <span className={s.heading}>Overview</span>
          <DatePicker.RangePicker value={dateRange} onChange={setDateRange} />
        </div>

        <div className={s.container}>
          <OverviewCard
            sections={[
              {
                title: 'Avg QA evaluation score',
                value: map(
                  dataRes,
                  ({ avgQaEvaluationScore }) => `${avgQaEvaluationScore.toFixed(2)}%`,
                ),
                description: 'No. of alerts QA’d vs. No. of alerts assigned for QA',
              },
            ]}
          />
          <OverviewCard
            sections={[
              {
                title: 'QA pass %',
                value: map(
                  dataRes,
                  ({ qaPassedPercentage }) => `${qaPassedPercentage.toFixed(2)}%`,
                ),
                description: 'No. of alerts QA passed vs. No. of alerts QA’d',
              },
              {
                title: 'QA failed %',
                value: map(
                  dataRes,
                  ({ qaFailedPercentage }) => `${qaFailedPercentage.toFixed(2)}%`,
                ),
                description: 'No. of alerts QA failed vs. No. of alerts QA’d',
              },
            ]}
          />
        </div>
      </div>
    </WidgetBase>
  );
}
