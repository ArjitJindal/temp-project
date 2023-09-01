import { Col, Row } from 'antd';
import styles from './styles.module.less';
import { useApi } from '@/api';
import { DashboardStatsOverview } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { DASHBOARD_OVERVIEW } from '@/utils/queries/keys';
import * as Card from '@/components/ui/Card';
import { H4, P } from '@/components/ui/Typography';
import { formatDuration, getDuration } from '@/utils/time-utils';

const OverviewSingleCard = ({ title, value }: { title: string; value: number | string }) => (
  <Col span={6}>
    <Card.Root isCollapsable={false} noBorder className={styles.card}>
      <P variant="sml" grey className={styles.cardTitle}>
        {title}
      </P>
      <P variant="2xl">{value}</P>
    </Card.Root>
  </Col>
);

export default function OverviewCard() {
  const api = useApi();
  const queryResults = useQuery(
    DASHBOARD_OVERVIEW(),
    async () => await api.getDashboardStatsOverview(),
  );

  return (
    <AsyncResourceRenderer<DashboardStatsOverview> resource={queryResults.data}>
      {({
        totalOpenAlerts,
        totalOpenCases,
        averageInvestigationTimeAlerts,
        averageInvestigationTimeCases,
      }) => {
        return (
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <H4>Overview</H4>
            </Col>
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
          </Row>
        );
      }}
    </AsyncResourceRenderer>
  );
}
