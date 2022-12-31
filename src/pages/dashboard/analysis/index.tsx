import { Col, Row } from 'antd';
import TransactionsChartCard from './components/TransactionsChartCard';
import RuleHitCard from './components/RulesHitCard';
import TopUsersHitCard from './components/TopUsersHitCard';
import DRSDistributionCard from './components/DRSDistributionCard';
import PageWrapper from '@/components/PageWrapper';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { usePageViewTracker } from '@/utils/tracker';

function Analysis() {
  usePageViewTracker('Dashboard Analysis Page');
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
        <Feature name="PULSE_KRS_CALCULATION">
          <Col span={24}>
            <DRSDistributionCard />
          </Col>
        </Feature>
      </Row>
    </PageWrapper>
  );
}

export default Analysis;
