import { Col, Row } from 'antd';
import TransactionsChartCard from './components/TransactionsChartCard';
import RuleHitCard from './components/RulesHitCard';
import TopUsersHitCard from './components/TopUsersHitCard';
import DRSDistributionCard from './components/DRSDistributionCard';
import TeamPerformanceCard from './components/TeamPerformanceCard';
import PageWrapper from '@/components/PageWrapper';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { usePageViewTracker } from '@/utils/tracker';

function Analysis() {
  usePageViewTracker('Dashboard Analysis Page');
  const isPulseEnabled = useFeatureEnabled('PULSE');
  return (
    <PageWrapper>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <TransactionsChartCard />
        </Col>
        <Col span={24}>
          <TopUsersHitCard />
        </Col>
        <Col span={24}>
          <RuleHitCard />
        </Col>
        {isPulseEnabled ? (
          <>
            <Col span={12}>
              <DRSDistributionCard />
            </Col>
            <Col span={12}>
              <TeamPerformanceCard />
            </Col>
          </>
        ) : (
          <Col span={24}>
            <TeamPerformanceCard />
          </Col>
        )}
      </Row>
    </PageWrapper>
  );
}

export default Analysis;
