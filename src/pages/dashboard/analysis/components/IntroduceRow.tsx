import { InfoCircleOutlined } from '@ant-design/icons';
import { TinyArea, TinyColumn, Progress } from '@ant-design/charts';
import { Col, Row, Tooltip } from 'antd';

import numeral from 'numeral';
import { ChartCard } from './Charts';
import type { DataItem } from '../data.d';

const topColResponsiveProps = {
  xs: 24,
  sm: 12,
  md: 12,
  lg: 12,
  xl: 6,
  style: { marginBottom: 24 },
};

const IntroduceRow = ({ loading, visitData }: { loading: boolean; visitData: DataItem[] }) => (
  <Row gutter={24}>
    <Col {...topColResponsiveProps}>
      <ChartCard
        bordered={false}
        loading={loading}
        title="Transaction Volume"
        action={
          <Tooltip title="Transactions count">
            <InfoCircleOutlined />
          </Tooltip>
        }
        total={numeral(8846).format('0,0')}
        contentHeight={46}
      >
        <TinyArea xField="x" height={46} forceFit yField="y" smooth data={visitData} />
      </ChartCard>
    </Col>
    <Col {...topColResponsiveProps}>
      <ChartCard
        bordered={false}
        loading={loading}
        title="Flagged Transactions"
        action={
          <Tooltip title="Flagged Transactions count">
            <InfoCircleOutlined />
          </Tooltip>
        }
        total={numeral(560).format('0,0')}
        contentHeight={46}
      >
        <TinyColumn color="#f6bd16" xField="x" height={46} forceFit yField="y" data={visitData} />
      </ChartCard>
    </Col>
    <Col {...topColResponsiveProps}>
      <ChartCard
        bordered={false}
        loading={loading}
        title="Stopped Transactions"
        action={
          <Tooltip title="Stopped Transactions count">
            <InfoCircleOutlined />
          </Tooltip>
        }
        total={numeral(613).format('0,0')}
        contentHeight={46}
      >
        <TinyColumn color="#ec6454" xField="x" height={46} forceFit yField="y" data={visitData} />
      </ChartCard>
    </Col>
    <Col {...topColResponsiveProps}>
      <ChartCard
        loading={loading}
        bordered={false}
        title="Percentage of transactions passed"
        action={
          <Tooltip title="Passed transaction percentage">
            <InfoCircleOutlined />
          </Tooltip>
        }
        total="78%"
        contentHeight={46}
      >
        <Progress
          height={46}
          percent={0.78}
          color="#13C2C2"
          forceFit
          size={8}
          marker={[
            {
              value: 0.8,
              style: {
                stroke: '#13C2C2',
              },
            },
          ]}
        />
      </ChartCard>
    </Col>
  </Row>
);

export default IntroduceRow;
