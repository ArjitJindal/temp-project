import { OverviewCard } from '../widgets/OverviewCard';
import s from './index.module.less';
import { useApi } from '@/api';
import { DashboardStatsOverview } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_OVERVIEW_TOTAL } from '@/utils/queries/keys';
import { formatDuration, getDuration } from '@/utils/time-utils';
import { WidgetProps } from '@/components/library/Widget/types';
import WidgetBase from '@/components/library/Widget/WidgetBase';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props extends WidgetProps {}

export default function Overview(props: Props) {
  const api = useApi();
  const queryResult = useQuery(DASHBOARD_OVERVIEW_TOTAL(), async () => {
    return await api.getDashboardStatsOverview({});
  });
  const isSarEnabled = useFeatureEnabled('SAR');
  return (
    <AsyncResourceRenderer<DashboardStatsOverview> resource={queryResult.data}>
      {({
        totalOpenAlerts,
        totalOpenCases,
        averageInvestigationTimeAlerts,
        averageInvestigationTimeCases,
        totalSarReported,
      }) => (
        <WidgetBase {...props}>
          <div className={s.root}>
            <OverviewCard
              sections={[
                {
                  title: 'Open cases',
                  value: totalOpenCases || '0',
                },
              ]}
            />

            <OverviewCard
              sections={[
                {
                  title: 'Open alerts',
                  value: totalOpenAlerts || '0',
                },
              ]}
            />
            <OverviewCard
              sections={[
                {
                  title: 'Avg. investigation time/case',
                  value: formatDuration(getDuration(averageInvestigationTimeCases)) || '0',
                },
              ]}
            />
            <OverviewCard
              sections={[
                {
                  title: 'Avg. investigation time/alert',
                  value: formatDuration(getDuration(averageInvestigationTimeAlerts)) || '0',
                },
              ]}
            />
            {isSarEnabled && (
              <OverviewCard
                sections={[
                  {
                    title: `SAR's reported`,
                    value: totalSarReported || '0',
                  },
                ]}
              />
            )}
          </div>
        </WidgetBase>
      )}
    </AsyncResourceRenderer>
  );
}
