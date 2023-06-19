import { Col, Row } from 'antd';
import { DeltaCard } from './DeltaCard';
import { DeltaChart } from './DeltaChart';
import COLORS from '@/components/ui/colors';
import { SimulationBeaconIteration } from '@/apis';
import * as Card from '@/components/ui/Card';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import TransactionIcon from '@/components/ui/icons/transaction.react.svg';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';

interface SimulationStatisticsProps {
  iteration: SimulationBeaconIteration;
}

export function SimulationStatistics(props: SimulationStatisticsProps) {
  const { iteration } = props;
  const { current, simulated } = iteration.statistics;
  const beforeCaseTruePositives =
    current?.totalCases != null && current?.falsePositivesCases != null
      ? current.totalCases - current.falsePositivesCases
      : undefined;
  const afterCaseTruePositives =
    simulated?.totalCases != null && simulated?.falsePositivesCases != null
      ? simulated.totalCases - simulated.falsePositivesCases
      : undefined;
  return (
    <Card.Section>
      <Row gutter={20}>
        <Col span={8}>
          <DeltaCard
            icon={<StackLineIcon />}
            title="Delta of cases created"
            beforeValue={iteration.statistics.current?.totalCases}
            afterValue={iteration.statistics.simulated?.totalCases}
          />
          <DeltaChart
            title="Cases"
            beforeValues={[
              {
                value: beforeCaseTruePositives,
                type: 'True positive (before)',
              },
              {
                value: current?.falsePositivesCases,
                type: 'False positive (before)',
              },
            ]}
            afterValues={[
              {
                value: afterCaseTruePositives,
                type: 'True positive (after)',
              },
              {
                value: simulated?.falsePositivesCases,
                type: 'False positive (after)',
              },
            ]}
            beforeColor={COLORS.navyBlue.base}
            beforeFalsePositiveColor={COLORS.brandBlue.base}
            afterColor={COLORS.navyBlue.shade}
            afterFalsePositiveColor={COLORS.brandBlue.shade}
          />
        </Col>
        <Col span={8}>
          <DeltaCard
            icon={<TransactionIcon />}
            title="Delta of transactions hit"
            beforeValue={iteration.statistics.current?.transactionsHit}
            afterValue={iteration.statistics.simulated?.transactionsHit}
          />
          <DeltaChart
            title="Transaction's hit"
            beforeValues={[{ value: current?.transactionsHit, type: 'Before' }]}
            afterValues={[{ value: simulated?.transactionsHit, type: 'After' }]}
            beforeColor={COLORS.orange.base}
            afterColor={COLORS.lightOrange.base}
          />
        </Col>
        <Col span={8}>
          <DeltaCard
            icon={<User3LineIcon />}
            title="Delta of users hit"
            beforeValue={iteration.statistics.current?.usersHit}
            afterValue={iteration.statistics.simulated?.usersHit}
          />
          <DeltaChart
            title="User's hit"
            beforeValues={[{ value: current?.usersHit, type: 'Before' }]}
            afterValues={[{ value: simulated?.usersHit, type: 'After' }]}
            beforeColor={COLORS.green.base}
            afterColor={COLORS.lightGreen.base}
          />
        </Col>
      </Row>
    </Card.Section>
  );
}
