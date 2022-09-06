import { Card, Empty } from 'antd';
import numeral from 'numeral';
import { Pie, PieConfig } from '@ant-design/charts';
import styles from '../style.module.less';
import { DashboardStatsRulesCountData } from '@/apis';
import { getRuleInstanceDisplayId } from '@/pages/rules/utils';

const transformData = (data: DashboardStatsRulesCountData[] | []) => {
  return data.map((item: DashboardStatsRulesCountData) => {
    return {
      x: getRuleInstanceDisplayId(item.ruleId, item.ruleInstanceId),
      y: item.hitCount,
    };
  });
};

const RulesHitBreakdownChart = ({
  loading,
  data,
}: {
  loading: boolean;
  data: DashboardStatsRulesCountData[];
}) => {
  return (
    <Card
      loading={loading}
      className={styles.salesCard}
      bordered={false}
      style={{
        height: '100%',
      }}
    >
      {!data.length ? (
        <Empty />
      ) : (
        <div>
          <Pie
            autoFit
            radius={0.75}
            innerRadius={0.6}
            angleField="y"
            colorField="x"
            interactions={[
              {
                type: 'element-selected',
              },
              {
                type: 'element-active',
              },
            ]}
            data={transformData(data) as any}
            legend={{
              visible: false,
            }}
            label={{
              //type: 'spider',
              content: (text, item) => {
                // eslint-disable-next-line no-underscore-dangle
                return `${item._origin.x}: ${numeral(item._origin.y).format('0,0')} Hits`;
              },
            }}
            statistic={
              {
                title: { content: 'Total Hits' },
              } as PieConfig['statistic']
            }
          />
        </div>
      )}
    </Card>
  );
};

export default RulesHitBreakdownChart;
