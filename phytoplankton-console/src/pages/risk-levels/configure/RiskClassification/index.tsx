import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import RiskClassificationTable, {
  State,
  parseApiState,
  prepareApiState,
  State as RiskClassificationTableState,
} from '../RiskClassificationTable';
import Header from './Header';
import { useHasResources } from '@/utils/user-utils';
import { RiskClassificationConfig } from '@/apis';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import { useNewVersionId } from '@/utils/version';
import VersionHistoryFooter from '@/components/VersionHistory/Footer';
import { useApi } from '@/api';
import { getOr } from '@/utils/asyncResource';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { RISK_CLASSIFICATION_WORKFLOW_PROPOSAL } from '@/utils/queries/keys';

type Props = {
  riskValues: RiskClassificationConfig;
  state: State | null;
  setState: React.Dispatch<React.SetStateAction<State | null>>;
  riskValuesRefetch: () => void;
};

export default function RiskQualification(props: Props) {
  const hasRiskLevelPermission = useHasResources(['write:::risk-scoring/risk-levels/*']);
  const { riskValues, state, setState, riskValuesRefetch } = props;
  const newVersionIdQuery = useNewVersionId('RiskClassification');
  const riskLevelId = getOr(newVersionIdQuery.data, {
    id: '',
  });
  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');
  const [isUpdateEnabled, setIsUpdateEnabled] = useState(false);
  const api = useApi();
  const queryClient = useQueryClient();

  const [showProposal, setShowProposal] = useState<RiskClassificationTableState | null>(null);

  const versionHistoryMutation = useMutation<RiskClassificationConfig, Error, { comment: string }>(
    async ({ comment }: { comment: string }) => {
      if (!state) {
        throw new Error('No state available');
      }
      return api.postPulseRiskClassification({
        RiskClassificationRequest: { scores: prepareApiState(state), comment: comment },
      });
    },
    {
      onSuccess: () => {
        riskValuesRefetch();
        setIsUpdateEnabled(false);
        newVersionIdQuery.refetch();
        setState(parseApiState(riskValues.classificationValues));
        setIsUpdateEnabled(false);
        queryClient.invalidateQueries(RISK_CLASSIFICATION_WORKFLOW_PROPOSAL());
      },
      onError: (error) => {
        message.error(getErrorMessage(error));
      },
    },
  );

  function handleCancel() {
    setState(parseApiState(riskValues.classificationValues));
    setIsUpdateEnabled(false);
  }

  // todo: i18n

  return (
    <PageWrapperContentContainer
      footer={
        isUpdateEnabled && (
          <VersionHistoryFooter<RiskClassificationConfig>
            onCancel={handleCancel}
            mutation={versionHistoryMutation}
            modalTitle="Update risk levels"
            modalIdLabel="Risk level version"
            versionId={riskLevelId.id ?? ''}
            isDisabled={!riskValues.classificationValues.length || !isUpdateEnabled}
            footerMessage={`Note that updating risk level would save the configuration as a new version${
              isApprovalWorkflowsEnabled ? '. Also, updating risk level would require approval' : ''
            }.`}
          />
        )
      }
    >
      {!isUpdateEnabled && (
        <Header
          riskValues={riskValues}
          showProposalState={[showProposal, setShowProposal]}
          updateEnabledState={[isUpdateEnabled, setIsUpdateEnabled]}
          requiredResources={['write:::risk-scoring/risk-levels/*']}
        />
      )}
      <RiskClassificationTable
        state={showProposal != null ? showProposal : state}
        setState={showProposal != null ? () => {} : setState}
        isDisabled={
          !riskValues.classificationValues.length || !hasRiskLevelPermission || !isUpdateEnabled
        }
      />
    </PageWrapperContentContainer>
  );
}
