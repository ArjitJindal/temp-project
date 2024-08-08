import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import Modal from '@/components/library/Modal';
import Form, { FormRef } from '@/components/library/Form';
import {
  FileInfo,
  InternalConsumerUser,
  InternalBusinessUser,
  UserState,
  Comment,
  KYCAndUserStatusChangeReason,
  UserStateDetailsInternal,
} from '@/apis';
import { useApi } from '@/api';
import { CloseMessage, message } from '@/components/library/Message';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import { humanizeConstant } from '@/utils/humanize';
import TextArea from '@/components/library/TextArea';
import NarrativesSelectStatusChange from '@/pages/case-management/components/NarrativesSelectStatusChange';
import { KYC_AND_USER_STATUS_CHANGE_REASONS } from '@/apis/models-custom/KYCAndUserStatusChangeReason';
import { DefaultApiPostConsumerUsersUserIdRequest } from '@/apis/types/ObjectParamAPI';
import { USER_AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import { USER_STATES } from '@/apis/models-custom/UserState';
import Label from '@/components/library/Label';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  user: InternalConsumerUser | InternalBusinessUser;
  onOkay: (userStatus: UserState, comment: Comment) => void;
}

interface FormValues {
  userStatus?: UserState | '';
  reason: KYCAndUserStatusChangeReason | '';
  otherReason: string | undefined;
  comment: string;
  files: FileInfo[];
}
const DEFAULT_INITIAL_VALUES: FormValues = {
  userStatus: '',
  reason: '',
  otherReason: undefined,
  comment: '',
  files: [],
};
export default function UserChangeModal(props: Props) {
  const { title, isVisible, onClose, user, onOkay } = props;
  const [fileList, setFileList] = useState<FileInfo[]>(DEFAULT_INITIAL_VALUES.files);
  const ref = useRef<FormRef<FormValues>>(null);
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: DEFAULT_INITIAL_VALUES,
    isValid: false,
  });
  const isOtherReason = useMemo(() => {
    return formState.values.reason === 'Other';
  }, [formState.values.reason]);

  useEffect(() => {
    setFormState((prevState) => ({
      ...prevState,
      values: {
        ...prevState.values,
        files: fileList,
      },
    }));
  }, [fileList]);
  const api = useApi();

  const queryClient = useQueryClient();
  let messageLoading: CloseMessage | undefined;
  const mutation = useMutation(
    async (values: FormValues) => {
      const { files, comment, otherReason, reason, userStatus } = values;
      messageLoading = message.loading('Changing User Status...');
      if (userStatus === '' || userStatus == null) {
        throw new Error('User Status Empty');
      }
      const newStateDetails: UserStateDetailsInternal = {
        state: userStatus,
        reason: reason === 'Other' && otherReason ? otherReason : reason,
      };

      const commentText = comment;
      const commentContent = {
        Comment: {
          body: commentText,
          files: files,
        },
      };
      const params: DefaultApiPostConsumerUsersUserIdRequest = {
        userId: user.userId,
        UserUpdateRequest: {
          userStateDetails: newStateDetails,
          comment: commentContent.Comment,
        },
      };
      let updatedComment: Comment | undefined;
      if (user.type === 'CONSUMER') {
        updatedComment = await api.postConsumerUsersUserId(params);
      } else {
        updatedComment = await api.postBusinessUsersUserId(params);
      }

      return { userStatus, updatedComment };
    },
    {
      onSuccess: async (data) => {
        message.success(`User status updated`);
        ref.current?.setValues(DEFAULT_INITIAL_VALUES);
        onOkay(data.userStatus, data.updatedComment);
        onClose();
        messageLoading?.();
        await queryClient.invalidateQueries(USER_AUDIT_LOGS_LIST(user.userId, {}));
      },
      onError: (error: Error) => {
        message.error(`Error Changing User Status: ${error.message}`);
        messageLoading?.();
      },
    },
  );
  return (
    <>
      <Modal
        okText="Confirm"
        cancelText="Cancel"
        width="S"
        title={title}
        onCancel={onClose}
        isOpen={isVisible}
        onOk={() => {
          setAlwaysShowErrors(true);
          if (formState.isValid) {
            mutation.mutate(formState.values);
          }
        }}
        writePermissions={['users:user-overview:write']}
      >
        <Form<FormValues>
          initialValues={DEFAULT_INITIAL_VALUES}
          ref={ref}
          onChange={setFormState}
          fieldValidators={{
            userStatus: notEmpty,
            reason: notEmpty,
            otherReason: isOtherReason ? notEmpty : undefined,
            comment: notEmpty,
          }}
          alwaysShowErrors={alwaysShowErrors}
        >
          <InputField<FormValues, 'userStatus'>
            name="userStatus"
            label="User status"
            labelProps={{
              required: {
                showHint: true,
                value: true,
              },
            }}
          >
            {(inputProps) => (
              <Select
                {...inputProps}
                options={USER_STATES.map((userStatus: UserState) => ({
                  label: humanizeConstant(userStatus),
                  value: userStatus,
                }))}
                mode="SINGLE"
              />
            )}
          </InputField>
          <InputField<FormValues, 'reason'>
            name="reason"
            label="Reason"
            labelProps={{
              required: {
                showHint: true,
                value: true,
              },
            }}
          >
            {(inputProps) => (
              <Select
                {...inputProps}
                options={KYC_AND_USER_STATUS_CHANGE_REASONS.map(
                  (reason: KYCAndUserStatusChangeReason) => ({
                    label: reason,
                    value: reason,
                  }),
                )}
                mode="SINGLE"
              />
            )}
          </InputField>
          {isOtherReason && (
            <InputField<FormValues, 'otherReason'>
              name="otherReason"
              label="Describe the reason"
              labelProps={{
                required: {
                  value: true,
                  showHint: true,
                },
              }}
            >
              {(inputProps) => <TextInput {...inputProps} />}
            </InputField>
          )}
          <div className={s.comment}>
            <InputField<FormValues, 'comment'>
              name={'comment'}
              label={'Comment'}
              labelProps={{
                required: {
                  value: true,
                  showHint: true,
                },
              }}
            >
              {(inputProps) => (
                <>
                  <NarrativesSelectStatusChange
                    templateValue={null}
                    setTemplateValue={(value) => {
                      inputProps?.onChange?.(value);
                    }}
                  />
                  <TextArea
                    {...inputProps}
                    rows={4}
                    placeholder={`Write a narrative explaining the User Status change reason and findings, if any.`}
                  />
                </>
              )}
            </InputField>
          </div>
          <Label label={'Upload attachments'}>
            <FilesDraggerInput
              onChange={(value) => {
                setFileList(value ?? []);
              }}
              value={fileList}
            />
          </Label>
        </Form>
      </Modal>
    </>
  );
}
