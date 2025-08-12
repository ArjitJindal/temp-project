import { Resource } from '@flagright/lib/utils';
import DefaultActions from './DefaultActions';
import ApprovalWorkflowActions from './ApprovalWorkflowActions';
import { RiskClassificationConfig } from '@/apis';
import { StatePair } from '@/utils/state';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { State as RiskClassificationTableState } from '@/pages/risk-levels/configure/RiskClassificationTable';

export type Props = {
  requiredResources?: Resource[];
  riskValues: RiskClassificationConfig;
  showProposalState: StatePair<RiskClassificationTableState | null>;
  updateEnabledState: StatePair<boolean>;
};

export default function Header(props: Props) {
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  if (!isApprovalWorkflowsEnabled) {
    return <DefaultActions {...props} />;
  }

  return <ApprovalWorkflowActions {...props} />;
}
