import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { DeltaCard } from './DeltaCard';
import { DeltaChart } from './DeltaChart';
import styles from './index.module.less';
import COLORS from '@/components/ui/colors';
import { SimulationBeaconIteration } from '@/apis';
import * as Card from '@/components/ui/Card';
import StackLineIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';
import TransactionIcon from '@/components/ui/icons/transaction.react.svg';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import { Progress } from '@/components/Simulation/Progress';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
interface SimulationStatisticsProps {
  pdfMode?: boolean;
  iteration: SimulationBeaconIteration;
}

export function SimulationStatistics(props: SimulationStatisticsProps) {
  const settings = useSettings();
  const { iteration, pdfMode } = props;
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
    <>
      {iteration.progress < 1 && (
        <Progress
          simulationStartedAt={iteration.createdAt ?? 0}
          width="FULL"
          progress={iteration.progress * 100}
          message="Running the simulation on subset of transactions & generating results for you."
          status={iteration.latestStatus.status}
          totalEntities={iteration.totalEntities}
        />
      )}
      <Card.Root>
        <Card.Section>
          <div className={styles.rowContainer}>
            <div className={styles.colContainer}>
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
                pdfMode={pdfMode}
              />
            </div>
            <div className={styles.colContainer}>
              <DeltaCard
                icon={<TransactionIcon />}
                title="Delta of transactions hit"
                beforeValue={iteration.statistics.current?.transactionsHit}
                afterValue={iteration.statistics.simulated?.transactionsHit}
              />
              <DeltaChart
                title="Transactions hit"
                beforeValues={[{ value: current?.transactionsHit, type: 'Before' }]}
                afterValues={[{ value: simulated?.transactionsHit, type: 'After' }]}
                beforeColor={COLORS.orange.base}
                afterColor={COLORS.lightOrange.base}
                pdfMode={pdfMode}
              />
            </div>
            <div className={styles.colContainer}>
              <DeltaCard
                icon={<User3LineIcon />}
                title={`Delta of ${settings.userAlias}s hit`}
                beforeValue={iteration.statistics.current?.usersHit}
                afterValue={iteration.statistics.simulated?.usersHit}
              />
              <DeltaChart
                title={`${firstLetterUpper(settings.userAlias)}s hit`}
                beforeValues={[{ value: current?.usersHit, type: 'Before' }]}
                afterValues={[{ value: simulated?.usersHit, type: 'After' }]}
                beforeColor={COLORS.green.base}
                afterColor={COLORS.lightGreen.base}
                pdfMode={pdfMode}
              />
            </div>
          </div>
        </Card.Section>
      </Card.Root>
    </>
  );
}
