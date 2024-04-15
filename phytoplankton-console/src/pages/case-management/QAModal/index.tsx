import { useCallback, useMemo, useState } from 'react';
import { isEmpty, omitBy } from 'lodash';
import { useNavigate } from 'react-router';
import { TableSearchParams } from '../types';
import s from './style.module.less';
import Dropdown, { DropdownOption } from '@/components/library/Dropdown';
import Button from '@/components/library/Button';
import ArrowDownSLineIcon from '@/components/ui/icons/Remix/system/arrow-down-s-line.react.svg';
import { AllParams } from '@/components/library/Table/types';
import Modal from '@/components/library/Modal';
import Form from '@/components/library/Form';
import { AlertsQaSamplingRequest } from '@/apis';
import InputField from '@/components/library/Form/InputField';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';
import Select from '@/components/library/Select';
import { PRIORITYS } from '@/apis/models-custom/Priority';
import Slider from '@/components/library/Slider';
import Alert from '@/components/library/Alert';
import { useApi } from '@/api';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { message } from '@/components/library/Message';
import { useHasPermissions } from '@/utils/user-utils';

type OptionTypes = 'CREATE_SAMPLE' | 'VIEW_SAMPLE';

interface Props {
  params: AllParams<TableSearchParams>;
}

interface FormValues extends Omit<AlertsQaSamplingRequest, 'filters'> {}

const initialValues: FormValues = {
  samplingName: '',
  samplingDescription: '',
  priority: 'P1',
  samplingPercentage: 20,
};

export const QAButton = (props: Props) => {
  const { params } = props;
  const api = useApi();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const navigate = useNavigate();
  const isQAWriteEnabled = useHasPermissions(['case-management:qa:write']);

  const options: DropdownOption<OptionTypes>[] = useMemo(() => {
    const options: DropdownOption<OptionTypes>[] = [
      ...(!isQAWriteEnabled
        ? [{ value: 'CREATE_SAMPLE' as OptionTypes, label: 'Create sample' }]
        : []),
      { value: 'VIEW_SAMPLE', label: 'View samples' },
    ];

    return options;
  }, [isQAWriteEnabled]);

  const onSelect = useCallback(
    (option: DropdownOption<OptionTypes>) => {
      if (option.value === 'CREATE_SAMPLE') {
        setIsModalOpen(true);
      } else {
        navigate('/case-management/qa-sampling');
      }
    },
    [navigate],
  );

  const mutation = useMutation(
    async (data: AlertsQaSamplingRequest) => {
      return await api.createAlertsQaSampling({
        AlertsQaSamplingRequest: data,
      });
    },
    {
      onSuccess: (data) => {
        setIsModalOpen(false);
        message.success('Sample created successfully with id: ' + data.samplingId);
      },
      onError: () => {
        setIsModalOpen(false);
        message.fatal('Failed to create sample');
      },
    },
  );

  const onSubmit = useCallback(
    async (values: FormValues) => {
      const filters: AlertsQaSamplingRequest['filters'] = {
        alertClosedAt: {
          start: Number(params?.createdTimestamp?.[0] || 0),
          end: Number(params?.createdTimestamp?.[1] || Number.MAX_SAFE_INTEGER),
        },
        alertClosingReasons: params?.filterClosingReason,
        alertId: params?.alertId,
        assignedTo: params?.assignedTo,
        alertPriority: params?.alertPriority,
        caseTypes: params?.caseTypesFilter,
        qaAssignedTo: params?.qaAssignment,
        queueIds: params?.ruleQueueIds,
        ruleInstances: params?.rulesExecutedFilter,
        userId: params?.userId,
      };

      mutation.mutate({ ...values, filters: omitBy(filters, isEmpty) });
    },
    [params, mutation],
  );

  return (
    <>
      <Dropdown<OptionTypes> options={options} onSelect={onSelect}>
        {options.length > 0 && (
          <Button type="SECONDARY" testName="status-button">
            QA sampling
            <ArrowDownSLineIcon className={s.arrowIcon} />
          </Button>
        )}
      </Dropdown>
      <QAModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        onSubmit={onSubmit}
        type="CREATE"
      />
    </>
  );
};

export const QAModal = (props: {
  isModalOpen: boolean;
  setIsModalOpen: (value: boolean) => void;
  onSubmit: (values: FormValues) => void;
  type: 'CREATE' | 'EDIT';
  initialValues?: FormValues;
}) => {
  const { isModalOpen, setIsModalOpen, onSubmit, type } = props;

  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: props.initialValues || initialValues,
    isValid: false,
  });

  return (
    <Modal
      isOpen={isModalOpen}
      onCancel={() => setIsModalOpen(false)}
      title={type === 'CREATE' ? 'Create sample' : 'Edit sample'}
      okText={type === 'CREATE' ? 'Create' : 'Save'}
      onOk={() => formState.isValid && onSubmit(formState.values)}
    >
      <Form<FormValues>
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
        <InputField<FormValues, 'samplingName'>
          name="samplingName"
          label="Sample name"
          labelProps={{ required: true }}
        >
          {(inputProps) => <TextInput {...inputProps} />}
        </InputField>
        <InputField<FormValues, 'samplingDescription'>
          name="samplingDescription"
          label="Sample description"
          labelProps={{ required: true }}
        >
          {(inputProps) => <TextArea {...inputProps} rows={4} minHeight={'50px'} />}
        </InputField>
        <InputField<FormValues, 'priority'>
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
        <InputField<FormValues, 'samplingPercentage'>
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
              textInput={{ min: 0, max: 100, step: 1, htmlAttrs: { style: { width: '2.5rem' } } }}
              isDisabled={type === 'EDIT'}
            />
          )}
        </InputField>
        <Alert type="info">
          "Note that any filters applied to the Not QA’d alerts will be considered during the
          creation of a sample. "
        </Alert>
      </Form>
    </Modal>
  );
};
