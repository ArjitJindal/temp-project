import { Col, Row } from 'antd';
import TransactionsChartCard from './components/TransactionsChartCard';
import HitsPerUserCard from './components/HitsPerUserCard';
import RuleHitCard from './components/RulesHitCard';
import PageWrapper from '@/components/PageWrapper';

function Analysis() {
  return (
    <PageWrapper>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <TransactionsChartCard />
        </Col>
        <Col span={24}>
          <HitsPerUserCard direction="ORIGIN" />
        </Col>
        <Col span={24}>
          <HitsPerUserCard direction="DESTINATION" />
        </Col>
        <Col span={24}>
          <RuleHitCard />
        </Col>
      </Row>
    </PageWrapper>
  );
}

export default Analysis;
