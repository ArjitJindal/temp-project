import { useState } from 'react';
import s from './styles.module.less';
import Label from '@/components/library/Label';
import { message } from '@/components/library/Message';
import Modal from '@/components/library/Modal';
import Select from '@/components/library/Select';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useQaSample, useQaSampleIds } from '@/hooks/api/alerts';
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

  const queryResult = useQaSample(sampleId, { enabled: !!sampleId });

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
  const queryResults = useQaSampleIds();
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
