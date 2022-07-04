import type { FC } from 'react';
import { Col, Row } from 'antd';
import TransactionsChartCard from './components/TransactionsChartCard';
import HitsPerUserCard from './components/HitsPerUserCard';
import { AnalysisData } from './data.d';
import RuleHitCard from './components/RulesHitCard';

type AnalysisProps = {
  dashboardAndanalysis: AnalysisData;
  loading: boolean;
};

const Analysis: FC<AnalysisProps> = () => {
  return (
    <>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <TransactionsChartCard />
        </Col>
        <Col span={24}>
          <HitsPerUserCard />
        </Col>
        <Col span={24}>
          <RuleHitCard />
        </Col>
      </Row>
    </>
  );
};

export default Analysis;
