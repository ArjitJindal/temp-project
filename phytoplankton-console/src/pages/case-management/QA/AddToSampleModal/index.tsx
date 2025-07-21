import { useState } from 'react';
import s from './styles.module.less';
import { useApi } from '@/api';
import Label from '@/components/library/Label';
import { message } from '@/components/library/Message';
import Modal from '@/components/library/Modal';
import Select from '@/components/library/Select';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_QA_SAMPLE, QA_SAMPLE_IDS } from '@/utils/queries/keys';
import { P } from '@/components/ui/Typography';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';
import { PRIORITYS } from '@/apis/models-custom/Priority';

type Props = {
  isModalOpen: boolean;
  setIsModalOpen: (isOpen: boolean) => void;
  onAddToSample: (sampleId: string) => void;
};

const SampleDetails = (props: { sampleId: string }) => {
  const { sampleId } = props;
  const api = useApi();

  const queryResult = useQuery(
    ALERT_QA_SAMPLE(sampleId),
    async () => await api.getAlertsQaSample({ sampleId }),
    { enabled: !!sampleId },
  );

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {(data) => (
        <>
          <Label label="Sample name" required={{ showHint: true, value: true }}>
            <TextInput value={data.samplingName} isDisabled />
          </Label>
          <Label label="Sample description" required={{ showHint: true, value: true }}>
            <TextArea value={data.samplingDescription} isDisabled rows={4} />
          </Label>
          <Label label="Priority" required={{ showHint: true, value: true }}>
            <Select
              value={data.priority}
              isDisabled
              options={PRIORITYS.map((p) => ({ value: p, label: p }))}
            />
          </Label>
        </>
      )}
    </AsyncResourceRenderer>
  );
};

export const AddToSampleModal = (props: Props) => {
  const { isModalOpen, setIsModalOpen, onAddToSample } = props;
  const api = useApi();
  const queryResults = useQuery(QA_SAMPLE_IDS(), async () => await api.getAlertsQaSampleIds());
  const [selectedSampleId, setSelectedSampleId] = useState<string>();

  return (
    <Modal
      isOpen={isModalOpen}
      onCancel={() => setIsModalOpen(false)}
      title="Add to sample"
      okText="Add"
      onOk={() => {
        if (selectedSampleId) {
          onAddToSample(selectedSampleId);
          return;
        }
        message.error('Please select a sample ID');
      }}
    >
      <div className={s.container}>
        <Label label="Sample ID" required={{ showHint: true, value: true }}>
          <AsyncResourceRenderer resource={queryResults.data}>
            {(data) => (
              <Select
                value={selectedSampleId}
                onChange={setSelectedSampleId}
                placeholder="Select a sample ID"
                options={data.map((option) => ({
                  value: option.samplingId,
                  label: (
                    <div>
                      <P variant="m">{option.samplingId}</P>
                      <P variant="m">{option.samplingName}</P>
                    </div>
                  ),
                  labelText: option.samplingId,
                }))}
              />
            )}
          </AsyncResourceRenderer>
        </Label>
        {selectedSampleId && <SampleDetails sampleId={selectedSampleId} />}
      </div>
    </Modal>
  );
};
