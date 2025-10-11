import { useState } from 'react';
import Modal from '@/components/library/Modal';
import Form from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs } from '@/utils/dayjs';
import { InternalConsumerUser, InternalBusinessUser } from '@/apis';

import { AsyncResource, isLoading } from '@/utils/asyncResource';

interface Props {
  res: AsyncResource;
  isVisible: boolean;
  onClose: () => void;
  title: string;
  user: InternalConsumerUser | InternalBusinessUser;
  onConfirm: (formValues: FormValues) => void;
}

export interface FormValues {
  eoddDate: string;
}

const DEFAULT_INITIAL_VALUES: FormValues = {
  eoddDate: '',
};

export default function EODDChangeModal(props: Props) {
  const { res, title, isVisible, onClose, onConfirm } = props;
  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: DEFAULT_INITIAL_VALUES,
    isValid: false,
  });

  return (
    <Modal
      okText="Save"
      cancelText="Cancel"
      width="S"
      title={title}
      onCancel={onClose}
      isOpen={isVisible}
      onOk={() => {
        if (formState.isValid) {
          onConfirm(formState.values);
        }
      }}
      okProps={{
        isDisabled: isLoading(res),
      }}
      cancelProps={{
        isDisabled: isLoading(res),
      }}
      writeResources={['write:::users/user-overview/*']}
    >
      <Form<FormValues>
        initialValues={DEFAULT_INITIAL_VALUES}
        onChange={(formValue) => setFormState(formValue)}
        fieldValidators={{
          eoddDate: notEmpty,
        }}
      >
        <InputField<FormValues, 'eoddDate'>
          name="eoddDate"
          label="Set EODD date"
          labelProps={{
            required: {
              showHint: true,
              value: true,
            },
          }}
        >
          {({ value, onChange }) => (
            <DatePicker
              placeholder="MM/DD/YYYY"
              format="MM/DD/YYYY"
              value={value ? dayjs(value, 'MM/DD/YYYY') : null}
              onChange={(_date, dateString) => onChange?.(dateString)}
              style={{ width: '100%' }}
            />
          )}
        </InputField>
      </Form>
    </Modal>
  );
}
