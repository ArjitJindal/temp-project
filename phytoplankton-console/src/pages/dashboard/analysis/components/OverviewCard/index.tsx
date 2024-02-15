import s from './index.module.less';
import { useApi } from '@/api';
import { DashboardStatsOverview } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_OVERVIEW_TOTAL } from '@/utils/queries/keys';
import * as Card from '@/components/ui/Card';
import { P } from '@/components/ui/Typography';
import { formatDuration, getDuration } from '@/utils/time-utils';
import { WidgetProps } from '@/components/library/Widget/types';
import WidgetBase from '@/components/library/Widget/WidgetBase';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props extends WidgetProps {}

export default function OverviewCard(props: Props) {
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
            <OverviewSingleCard title="Open cases" value={totalOpenCases || '0'} />
            <OverviewSingleCard title="Open alerts" value={totalOpenAlerts || '0'} />
            <OverviewSingleCard
              title="Avg. investigation time/case"
              value={formatDuration(getDuration(averageInvestigationTimeCases)) || '0'}
            />
            <OverviewSingleCard
              title="Avg. investigation time/alert"
              value={formatDuration(getDuration(averageInvestigationTimeAlerts)) || '0'}
            />
            {isSarEnabled && (
              <OverviewSingleCard title={`SAR's reported`} value={totalSarReported || '0'} />
            )}
          </div>
        </WidgetBase>
      )}
    </AsyncResourceRenderer>
  );
}

const OverviewSingleCard = ({ title, value }: { title: string; value: number | string }) => (
  <Card.Root noBorder className={s.card}>
    <P variant="m" fontWeight="normal" grey className={s.cardTitle}>
      {title}
    </P>
    <P variant="2xl" fontWeight="normal">
      {value}
    </P>
  </Card.Root>
);
