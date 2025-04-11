import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Modal from '@/components/library/Modal';
import Form from '@/components/library/Form';
import { useApi } from '@/api';
import { message } from '@/components/library/Message';
import InputField from '@/components/library/Form/InputField';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs } from '@/utils/dayjs';
import { UserUpdateRequest } from '@/apis/models/UserUpdateRequest';
import { InternalConsumerUser, InternalBusinessUser } from '@/apis';
import { USER_AUDIT_LOGS_LIST } from '@/utils/queries/keys';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  user: InternalConsumerUser | InternalBusinessUser;
  onOkay: (eoddDate: string) => void;
}

interface FormValues {
  eoddDate: string;
}

const DEFAULT_INITIAL_VALUES: FormValues = {
  eoddDate: '',
};

export default function EODDChangeModal(props: Props) {
  const { title, isVisible, onClose, onOkay, user } = props;
  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: DEFAULT_INITIAL_VALUES,
    isValid: false,
  });
  const api = useApi();
  const queryClient = useQueryClient();

  const mutation = useMutation(
    async (values: FormValues) => {
      const messageLoading = message.loading('Updating EODD...');
      try {
        // Convert the date string to timestamp (number) for the API
        const dateTimestamp = values.eoddDate ? new Date(values.eoddDate).getTime() : 0;

        // Call API to update EODD
        const payload: UserUpdateRequest = {
          eoddDate: dateTimestamp,
        };

        let updatedComment;
        if (user.type === 'CONSUMER') {
          updatedComment = await api.postConsumerUsersUserId({
            userId: user.userId,
            UserUpdateRequest: payload,
          });
        } else {
          updatedComment = await api.postBusinessUsersUserId({
            userId: user.userId,
            UserUpdateRequest: payload,
          });
        }

        return { eoddDate: values.eoddDate, updatedComment };
      } finally {
        messageLoading();
      }
    },
    {
      onSuccess: async (data) => {
        message.success('EODD date updated successfully');
        onOkay(data.eoddDate);
        onClose();
        await queryClient.invalidateQueries(USER_AUDIT_LOGS_LIST(user.userId, {}));
      },
      onError: (error: Error) => {
        message.error(`Error updating EODD: ${error.message}`);
      },
    },
  );

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
          mutation.mutate(formState.values);
        }
      }}
      writePermissions={['users:user-overview:write']}
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
