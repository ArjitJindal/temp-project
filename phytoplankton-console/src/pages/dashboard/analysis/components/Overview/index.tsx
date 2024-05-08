import { OverviewCard } from '../widgets/OverviewCard';
import s from './index.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_OVERVIEW_TOTAL } from '@/utils/queries/keys';
import { formatDuration, getDuration } from '@/utils/time-utils';
import { WidgetProps } from '@/components/library/Widget/types';
import WidgetBase from '@/components/library/Widget/WidgetBase';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { map } from '@/utils/asyncResource';

interface Props extends WidgetProps {}

export default function Overview(props: Props) {
  const api = useApi();
  const queryResult = useQuery(DASHBOARD_OVERVIEW_TOTAL(), async () => {
    return await api.getDashboardStatsOverview({});
  });
  const isSarEnabled = useFeatureEnabled('SAR');
  const dataRes = queryResult.data;
  return (
    <WidgetBase {...props}>
      <div className={s.root}>
        <OverviewCard
          sections={[
            {
              title: 'Open cases',
              value: map(dataRes, ({ totalOpenCases }) => totalOpenCases || '0'),
            },
          ]}
        />
        <OverviewCard
          sections={[
            {
              title: 'Open alerts',
              value: map(dataRes, ({ totalOpenAlerts }) => totalOpenAlerts || '0'),
            },
          ]}
        />
        <OverviewCard
          sections={[
            {
              title: 'Avg. investigation time/case',
              value: map(
                dataRes,
                ({ averageInvestigationTimeCases }) =>
                  formatDuration(getDuration(averageInvestigationTimeCases)) || '0',
              ),
            },
          ]}
        />
        <OverviewCard
          sections={[
            {
              title: 'Avg. investigation time/alert',
              value: map(
                dataRes,
                ({ averageInvestigationTimeAlerts }) =>
                  formatDuration(getDuration(averageInvestigationTimeAlerts)) || '0',
              ),
            },
          ]}
        />
        {isSarEnabled && (
          <OverviewCard
            sections={[
              {
                title: `SAR's reported`,
                value: map(dataRes, ({ totalSarReported }) => totalSarReported || '0'),
              },
            ]}
          />
        )}
      </div>
    </WidgetBase>
  );
}
