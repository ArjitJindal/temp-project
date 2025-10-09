import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import RiskClassificationTable, {
  State as RiskClassificationTableState,
  parseApiState,
  prepareApiState,
} from '../RiskClassificationTable';
import Header from './Header';
import { useHasResources } from '@/utils/user-utils';
import { RiskClassificationConfig } from '@/apis';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import { useNewVersionId } from '@/hooks/api/version-history';
import VersionHistoryFooter from '@/components/VersionHistory/Footer';
import { getOr } from '@/utils/asyncResource';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';
import { RISK_CLASSIFICATION_WORKFLOW_PROPOSAL } from '@/utils/queries/keys';
import { usePendingProposal } from '@/hooks/api/risk-factors';
import { usePostRiskClassification } from '@/hooks/api/risk-classification';
import { useRiskLevelsChangesStrategy } from '@/hooks/api/workflows';

type Props = {
  riskValues: RiskClassificationConfig;
  state: RiskClassificationTableState | null;
  setState: React.Dispatch<React.SetStateAction<RiskClassificationTableState | null>>;
  riskValuesRefetch: () => void;
};

export default function RiskQualification(props: Props) {
  const hasRiskLevelPermission = useHasResources(['write:::risk-scoring/risk-levels/*']);
  const { riskValues, state, setState, riskValuesRefetch } = props;
  const newVersionIdQuery = useNewVersionId('RiskClassification');
  const riskLevelId = getOr(newVersionIdQuery.data, {
    id: '',
  });
  const [isUpdateEnabled, setIsUpdateEnabled] = useState(false);
  const queryClient = useQueryClient();
  const postRiskClassification = usePostRiskClassification();

  const [showProposal, setShowProposal] = useState<boolean>(true);
  const pendingProposalQueryResult = usePendingProposal();
  const changesStrategyRes = useRiskLevelsChangesStrategy();
  const changesStrategy = getOr(changesStrategyRes, 'DIRECT');

  const versionHistoryMutation = useMutation<RiskClassificationConfig, Error, { comment: string }>(
    async ({ comment }: { comment: string }) => {
      if (!state) {
        throw new Error('No state available');
      }
      const res = await postRiskClassification.mutateAsync({
        scores: prepareApiState(state),
        comment,
      });
      return res;
    },
    {
      onSuccess: () => {
        if (changesStrategy === 'APPROVE') {
          message.success('Approval proposal created successfully!', {
            details: 'Your changes need to be approved before applied',
          });
          queryClient.invalidateQueries(RISK_CLASSIFICATION_WORKFLOW_PROPOSAL());
          setState(parseApiState(riskValues.classificationValues));
        } else {
          message.success('New settings applied!');
          riskValuesRefetch();
          newVersionIdQuery.refetch();
        }
        setIsUpdateEnabled(false);
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

  const pendingProposal = getOr(pendingProposalQueryResult.data, null);
  const showingProposal = showProposal && pendingProposal != null;

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
              changesStrategy === 'APPROVE'
                ? '. Also, updating risk level would require approval'
                : ''
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
        state={
          showingProposal
            ? parseApiState(pendingProposal.riskClassificationConfig.classificationValues)
            : state
        }
        setState={showingProposal ? () => {} : setState}
        isDisabled={
          !riskValues.classificationValues.length ||
          !hasRiskLevelPermission ||
          !isUpdateEnabled ||
          showingProposal
        }
      />
    </PageWrapperContentContainer>
  );
}
