import { useMemo, useState } from 'react';
import { QAFormValues } from '../types';
import { TableSearchParams } from '../../types';
import { useAlertQuery } from '../../common';
import { ChecklistStatus } from '../../../../apis/models/ChecklistStatus';
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
import { AllParams } from '@/components/library/Table/types';
import { getOr } from '@/utils/asyncResource';
import { DefaultApiGetAlertListRequest } from '@/apis/types/ObjectParamAPI';

const initialValues: QAFormValues = {
  samplingName: '',
  samplingDescription: '',
  priority: 'P1',
  samplingQuantity: 0,
  filters: {},
  numberOfAlertsQaDone: 0,
  numberOfAlerts: 0,
};

type QAModalProps = {
  isModalOpen: boolean;
  setIsModalOpen: (value: boolean) => void;
  onSubmit: (values: QAFormValues) => void;
  type: 'CREATE' | 'EDIT';
  initialValues?: QAFormValues;
  sampleType: AlertsQaSampling['samplingType'];
  params?: AllParams<TableSearchParams>;
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
        {sampleType === 'AUTOMATIC' && <QASlider {...props} formState={formState} />}
      </Form>
    </Modal>
  );
};

const QASlider = (props: QAModalProps & { formState: { values: QAFormValues } }) => {
  const { type, params, formState, initialValues } = props;

  const alertsQueryResult = useAlertQuery(
    {
      ...(type === 'CREATE' && params),
      pageSize: 1,
      filterQaStatus: ["NOT_QA'd"],
      sort: [['createdAt', 'descend']],
      alertStatus: ['CLOSED'],
    },
    type === 'EDIT'
      ? ({
          ...params,
          filterQaStatus: ["NOT_QA'd" as ChecklistStatus],
          filterAlertStatus: ['CLOSED'],
          sortField: 'createdAt',
          sortOrder: 'descend',
        } as DefaultApiGetAlertListRequest)
      : undefined,
  );

  const count = useMemo(
    () => getOr(alertsQueryResult.data, { items: [], total: 0 }),
    [alertsQueryResult.data],
  );

  const alertsQAed = formState.values.numberOfAlertsQaDone;

  const totalAlerts =
    useMemo(() => (alertsQAed ?? 0) + (count?.total ?? 0), [alertsQAed, count.total]) || 0;

  return count != null ? (
    <>
      <InputField<QAFormValues, 'samplingQuantity'>
        name="samplingQuantity"
        label={'Number of Not QA’d alerts to be included'}
        labelProps={{ required: true }}
      >
        {(inputProps) => {
          const currentAlerts = initialValues?.numberOfAlerts || 0;

          return (
            <Slider
              {...inputProps}
              mode="SINGLE"
              min={currentAlerts}
              max={totalAlerts}
              marks={{ [currentAlerts]: `${currentAlerts}`, [totalAlerts]: totalAlerts }}
              textInput={{
                min: currentAlerts,
                max: totalAlerts,
                step: 1,
                htmlAttrs: { style: { width: '2.5rem' } },
              }}
            />
          );
        }}
      </InputField>
      <Alert type="INFO">
        {type === 'CREATE'
          ? 'Note that any filters applied to the Not QA’d alerts will be considered during the creation of a sample. '
          : 'Note that you can only increase the number of alerts in the sample. '}
      </Alert>
    </>
  ) : null;
};
