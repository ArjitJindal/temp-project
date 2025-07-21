import { SimulationHistoryTable } from 'src/pages/rules/simulation-history/SimulationHistoryTable';
import { Authorized } from '@/components/utils/Authorized';
import { BreadCrumbsWrapper } from '@/components/BreadCrumbsWrapper';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useSafeLocalStorageState } from '@/utils/hooks';

export default function SimulationHistoryPage() {
  const hasMachineLearningFeature = useFeatureEnabled('MACHINE_LEARNING');

  const [rulesTab] = useSafeLocalStorageState('rule-active-tab', 'rules-library', true);
  const title =
    rulesTab === 'my-rules'
      ? 'My rules'
      : rulesTab === 'rules-library' || !hasMachineLearningFeature
      ? 'Templates'
      : 'AI detection';
  return (
    <BreadCrumbsWrapper
      simulationStorageKey="SIMULATION_RULES"
      breadcrumbs={[
        {
          title: 'Rules',
          to: '/rules',
        },
        {
          title,
          to: `/rules/${rulesTab}`,
        },
        {
          title: 'Simulations history',
          to: `/rules/${rulesTab}/simulation-history`,
        },
      ]}
      simulationHistoryUrl="/rules/simulation-history"
      nonSimulationDefaultUrl="/rules/my-rules"
      simulationDefaultUrl="/rules/my-rules"
    >
      <Authorized minRequiredResources={['read:::simulator/simulations/*']} showForbiddenPage>
        <SimulationHistoryTable rulesTab={rulesTab} />
      </Authorized>
    </BreadCrumbsWrapper>
  );
}
