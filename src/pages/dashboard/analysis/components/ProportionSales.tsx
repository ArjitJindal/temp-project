import { Card, Typography } from 'antd';
import numeral from 'numeral';
import { Donut } from '@ant-design/charts';
import type { DonutConfig } from '@ant-design/charts/es/donut';
import React from 'react';
import type { DataItem } from '../data.d';
import styles from '../style.less';

const { Text } = Typography;

const ProportionSales = ({
  dropdownGroup,
  loading,
  salesPieData,
}: {
  loading: boolean;
  dropdownGroup: React.ReactNode;
  salesPieData: DataItem[];
}) => (
  <Card
    loading={loading}
    className={styles.salesCard}
    bordered={false}
    title="Transaction Breakdown"
    style={{
      height: '100%',
    }}
    extra={
      <div className={styles.salesCardExtra}>
        {dropdownGroup}
        <div className={styles.salesTypeRadio}></div>
      </div>
    }
  >
    <div>
      <Text>Status</Text>
      <Donut
        forceFit
        height={340}
        radius={0.8}
        angleField="y"
        colorField="x"
        data={salesPieData as any}
        legend={{
          visible: false,
        }}
        label={{
          visible: true,
          type: 'spider',
          formatter: (text, item) => {
            // eslint-disable-next-line no-underscore-dangle
            return `${item._origin.x}: ${numeral(item._origin.y).format('0,0')}`;
          },
        }}
        statistic={
          {
            totalLabel: 'Status',
          } as DonutConfig['statistic']
        }
      />
    </div>
  </Card>
);

export default ProportionSales;
