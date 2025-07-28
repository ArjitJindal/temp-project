import { useState } from 'react';
import { Resource } from '@flagright/lib/utils';
import RiskClassificationTable, {
  parseApiState,
  State as RiskClassificationTableState,
} from '../RiskClassificationTable';
import { useRiskClassificationMutation } from '../hooks/useRiskClassificationMutation';
import s from './index.module.less';
import Header from './Header';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { useHasResources } from '@/utils/user-utils';
import { RiskClassificationConfig } from '@/apis';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import Alert from '@/components/library/Alert';
import Modal from '@/components/library/Modal';
import Label from '@/components/library/Label';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';
import { RISK_LEVEL_VERSION } from '@/utils/queries/keys';
import { getOr } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { message } from '@/components/library/Message';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

type Props = {
  riskValues: RiskClassificationConfig;
  state: RiskClassificationTableState | null;
  setState: React.Dispatch<React.SetStateAction<RiskClassificationTableState | null>>;
};

export default function RiskClassification(props: Props) {
  const api = useApi();
  const requiredResources: Resource[] = ['write:::risk-scoring/risk-levels/*' as Resource];
  const hasRiskLevelPermission = useHasResources(requiredResources);
  const { riskValues, state, setState } = props;
  const riskLevelQueryResults = useQuery(RISK_LEVEL_VERSION(), async () => {
    const data = await api.getNewRiskLevelId();
    return {
      id: data.id ?? '',
    };
  });

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isUpdateEnabled, setIsUpdateEnabled] = useState(false);
  const [showProposedValues, setShowProposedValues] = useState<RiskClassificationTableState | null>(
    null,
  );

  const isApprovalWorkflowsEnabled = useFeatureEnabled('APPROVAL_WORKFLOWS');

  const saveRiskValuesMutation = useRiskClassificationMutation({
    successAction: () => {
      setState(parseApiState(riskValues.classificationValues));
      setIsUpdateEnabled(false);
      setIsModalOpen(false);
    },
  });

  async function handleSave() {
    if (state == null) {
      return;
    }
    if (!data.comment) {
      message.error('Comment is required');
      return;
    }
    saveRiskValuesMutation.mutate({ state, comment: data.comment });
  }

  function handleCancel() {
    setState(parseApiState(riskValues.classificationValues));
    setIsUpdateEnabled(false);
  }

  const riskLevelId = getOr(riskLevelQueryResults.data, { id: '' }).id;

  const [data, setData] = useState<{ riskLevel: string; comment: string }>({
    riskLevel: riskLevelId,
    comment: '',
  });

  const modal = (
    <Modal
      title="Update risk levels"
      isOpen={isModalOpen}
      onCancel={() => setIsModalOpen(false)}
      onOk={handleSave}
      okText="Save"
      width="M"
      okProps={{ isDisabled: saveRiskValuesMutation.isLoading }}
      cancelProps={{ isDisabled: saveRiskValuesMutation.isLoading }}
      maskClosable
      cancelText="Cancel"
    >
      <div className={s.modalContent}>
        <Label label="Risk level" position="TOP" required={{ showHint: true, value: true }}>
          <TextInput value={riskLevelId} isDisabled={true} />
        </Label>
        <Label label="Comment" position="TOP" required={{ showHint: true, value: true }}>
          <TextArea
            value={data.comment}
            onChange={(comment) => setData({ ...data, comment: comment ?? '' })}
            placeholder="Enter comment"
          />
        </Label>
      </div>
    </Modal>
  );

  return (
    <PageWrapperContentContainer
      footer={
        isUpdateEnabled && (
          <div className={s.footerButtons}>
            <Alert type="TRANSPARENT">
              {`Note that updating risk level would save the configuration as a new version. ${
                isApprovalWorkflowsEnabled && ' Also, updating risk level would require approval.'
              }`}
            </Alert>
            <div className={s.footerButtons}>
              <Button
                type="SECONDARY"
                onClick={() => setIsModalOpen(true)}
                isDisabled={!riskValues.classificationValues.length || isModalOpen}
              >
                Save
              </Button>
              <Button type="TETRIARY" onClick={handleCancel} isDisabled={isModalOpen}>
                Cancel
              </Button>
            </div>
          </div>
        )
      }
    >
      {modal}
      <Header
        state={state}
        riskValues={riskValues}
        showProposalState={[showProposedValues, setShowProposedValues]}
        updateEnabledState={[isUpdateEnabled, setIsUpdateEnabled]}
        requiredResources={requiredResources}
      />
      <RiskClassificationTable
        state={showProposedValues ?? state}
        setState={setState}
        isDisabled={
          !riskValues.classificationValues.length || !hasRiskLevelPermission || !isUpdateEnabled
        }
      />
    </PageWrapperContentContainer>
  );
}
