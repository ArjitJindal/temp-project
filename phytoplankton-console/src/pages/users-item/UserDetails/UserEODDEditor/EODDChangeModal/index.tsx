import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
import {
  USER_AUDIT_LOGS_LIST,
  USER_CHANGES_PROPOSALS,
  USER_CHANGES_PROPOSALS_BY_ID,
  USERS_ITEM,
} from '@/utils/queries/keys';
import { useMutation } from '@/utils/queries/mutations/hooks';

interface Props {
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
  const { title, isVisible, onClose, onConfirm } = props;
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

export function useEODDChangeMutation(
  user: InternalConsumerUser | InternalBusinessUser,
  makeProposal: boolean,
) {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation(
    async (vars: { formValues: FormValues; comment?: string }) => {
      const { formValues: values, comment } = vars;

      // Convert the date string to timestamp (number) for the API
      const dateTimestamp = values.eoddDate ? new Date(values.eoddDate).getTime() : 0;

      if (makeProposal) {
        const dismissLoading = message.loading('Creating a proposal...');
        try {
          if (!comment) {
            throw new Error(`Comment is required here`);
          }
          await api.postUserApprovalProposal({
            userId: user.userId,
            UserApprovalUpdateRequest: {
              proposedChanges: [
                {
                  field: 'eoddDate',
                  value: dateTimestamp,
                },
              ],
              comment: comment,
            },
          });
          await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
          await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS_BY_ID(user.userId));
        } finally {
          dismissLoading();
        }
      } else {
        const messageLoading = message.loading('Updating EODD...');
        try {
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
      }
    },
    {
      onSuccess: async () => {
        if (makeProposal) {
          message.success('Change proposal created successfully');
          await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS());
          await queryClient.invalidateQueries(USER_CHANGES_PROPOSALS_BY_ID(user.userId));
        } else {
          message.success('EODD date updated successfully');
          await queryClient.invalidateQueries(USERS_ITEM(user.userId));
          await queryClient.invalidateQueries(USER_AUDIT_LOGS_LIST(user.userId, {}));
        }
      },
      onError: (error: Error) => {
        message.fatal(`Error updating EODD: ${error.message}`);
      },
    },
  );
}
