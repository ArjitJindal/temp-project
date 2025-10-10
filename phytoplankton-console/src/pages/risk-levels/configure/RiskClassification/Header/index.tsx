import { Resource } from '@flagright/lib/utils';
import DefaultActions from './DefaultActions';
import ApprovalWorkflowActions from './ApprovalWorkflowActions';
import { RiskClassificationConfig } from '@/apis';
import { StatePair } from '@/utils/state';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export type Props = {
  requiredResources?: Resource[];
  riskValues: RiskClassificationConfig;
  showProposalState: StatePair<boolean>;
  updateEnabledState: StatePair<boolean>;
};

export default function Header(props: Props) {
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  if (!isApprovalWorkflowsEnabled) {
    return <DefaultActions {...props} />;
  }

  return <ApprovalWorkflowActions {...props} />;
}
