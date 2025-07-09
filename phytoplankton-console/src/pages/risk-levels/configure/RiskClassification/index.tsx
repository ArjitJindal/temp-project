import { useState } from 'react';
import RiskClassificationTable, { State, parseApiState } from '../RiskClassificationTable';
import RiskLevelsDownloadButton from '../components/RiskLevelsDownloadButton';
import { useRiskClassificationMutation } from '../hooks/useRiskClassificationMutation';
import s from './index.module.less';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { useHasResources } from '@/utils/user-utils';
import { RiskClassificationConfig } from '@/apis';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import EditIcon from '@/components/ui/icons/Remix/design/edit-line.react.svg';
import Alert from '@/components/library/Alert';
import Modal from '@/components/library/Modal';
import Label from '@/components/library/Label';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';
import { RISK_LEVEL_VERSION } from '@/utils/queries/keys';
import { getOr } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { message } from '@/components/library/Message';

type Props = {
  riskValues: RiskClassificationConfig;
  state: State | null;
  setState: React.Dispatch<React.SetStateAction<State | null>>;
  riskValuesRefetch: () => void;
};

export default function RiskQualification(props: Props) {
  const api = useApi();
  const hasRiskLevelPermission = useHasResources(['write:::risk-scoring/risk-levels/*']);
  const { riskValues, state, setState, riskValuesRefetch } = props;
  const riskLevelQueryResults = useQuery(RISK_LEVEL_VERSION(), async () => {
    const data = await api.getNewRiskLevelId();
    return {
      id: data.id ?? '',
    };
  });

  const [isUpdateEnabled, setIsUpdateEnabled] = useState(false);

  const saveRiskValuesMutation = useRiskClassificationMutation({
    successAction: riskValuesRefetch,
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

  const [isModalOpen, setIsModalOpen] = useState(false);
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

  // todo: i18n
  return (
    <PageWrapperContentContainer
      footer={
        isUpdateEnabled && (
          <div className={s.footerButtons}>
            <Alert type="TRANSPARENT">
              Note that updating risk level would save the configuration as a new version
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
      {!isUpdateEnabled && (
        <div className={s.header}>
          <div className={s.headerLeft}>{/*Empty div to align the header right*/}</div>
          <div className={s.headerRight}>
            <Button
              type="SECONDARY"
              onClick={() => setIsUpdateEnabled(true)}
              isDisabled={!riskValues.classificationValues.length || isUpdateEnabled}
              icon={<EditIcon />}
            >
              Update risk levels
            </Button>
            <RiskLevelsDownloadButton classificationValues={riskValues.classificationValues} />
          </div>
        </div>
      )}
      <RiskClassificationTable
        state={state}
        setState={setState}
        isDisabled={
          !riskValues.classificationValues.length || !hasRiskLevelPermission || !isUpdateEnabled
        }
      />
    </PageWrapperContentContainer>
  );
}
