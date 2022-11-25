import { Col, Row } from 'antd';
import TransactionsChartCard from './components/TransactionsChartCard';
import RuleHitCard from './components/RulesHitCard';
import TopUsersHitCard from './components/TopUsersHitCard';
import PageWrapper from '@/components/PageWrapper';

function Analysis() {
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
      </Row>
    </PageWrapper>
  );
}

export default Analysis;
