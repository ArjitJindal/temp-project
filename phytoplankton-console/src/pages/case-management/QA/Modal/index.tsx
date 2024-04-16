import { useState } from 'react';
import { QAFormValues } from '../types';
import Modal from '@/components/library/Modal';
import Form from '@/components/library/Form';
import { AlertsQaSampling } from '@/apis';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';
import Select from '@/components/library/Select';
import { PRIORITYS } from '@/apis/models-custom/Priority';
import Slider from '@/components/library/Slider';
import Alert from '@/components/library/Alert';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';

const initialValues: QAFormValues = {
  samplingName: '',
  samplingDescription: '',
  priority: 'P1',
  samplingPercentage: 20,
};

type QAModalProps = {
  isModalOpen: boolean;
  setIsModalOpen: (value: boolean) => void;
  onSubmit: (values: QAFormValues) => void;
  type: 'CREATE' | 'EDIT';
  initialValues?: QAFormValues;
  sampleType: AlertsQaSampling['samplingType'];
};

export const QAModal = (props: QAModalProps) => {
  const { isModalOpen, setIsModalOpen, onSubmit, type, sampleType } = props;

  const [formState, setFormState] = useState<{ values: QAFormValues; isValid: boolean }>({
    values: props.initialValues || initialValues,
    isValid: false,
  });

  return (
    <Modal
      isOpen={isModalOpen}
      onCancel={() => setIsModalOpen(false)}
      title={type === 'CREATE' ? 'Create a sample' : 'Edit sample'}
      okText={type === 'CREATE' ? 'Create' : 'Save'}
      onOk={() => formState.isValid && onSubmit(formState.values)}
    >
      <Form<QAFormValues>
        initialValues={formState.values}
        onChange={setFormState}
        fieldValidators={{
          samplingName: notEmpty,
          samplingDescription: notEmpty,
          samplingPercentage: (value) => {
            if (!value || value <= 0) {
              return 'Sampling % must be greater than 0';
            }

            return null;
          },
        }}
      >
        <InputField<QAFormValues, 'samplingName'>
          name="samplingName"
          label="Sample name"
          labelProps={{ required: true }}
        >
          {(inputProps) => <TextInput {...inputProps} />}
        </InputField>
        <InputField<QAFormValues, 'samplingDescription'>
          name="samplingDescription"
          label="Sample description"
          labelProps={{ required: true }}
        >
          {(inputProps) => <TextArea {...inputProps} rows={4} minHeight={'50px'} />}
        </InputField>
        <InputField<QAFormValues, 'priority'>
          name="priority"
          label="Priority"
          labelProps={{ required: true }}
        >
          {(inputProps) => (
            <Select
              {...inputProps}
              options={PRIORITYS.map((priority) => ({
                value: priority,
                label: priority,
              }))}
            />
          )}
        </InputField>
        {sampleType === 'AUTOMATIC' && (
          <>
            <InputField<QAFormValues, 'samplingPercentage'>
              name="samplingPercentage"
              label="Sampling %"
              labelProps={{ required: true }}
            >
              {(inputProps) => (
                <Slider
                  {...inputProps}
                  mode="SINGLE"
                  min={0}
                  max={100}
                  marks={{ 0: '0', 100: '100' }}
                  textInput={{
                    min: 0,
                    max: 100,
                    step: 1,
                    htmlAttrs: { style: { width: '2.5rem' } },
                  }}
                />
              )}
            </InputField>
            <Alert type="info">
              {type === 'CREATE'
                ? 'Note that any filters applied to the Not QA’d alerts will be considered during the creation of a sample. '
                : 'Note that you can only extend the sampling %. Extending the sampling % will add alerts to the existing sample.'}
            </Alert>
          </>
        )}
      </Form>
    </Modal>
  );
};
