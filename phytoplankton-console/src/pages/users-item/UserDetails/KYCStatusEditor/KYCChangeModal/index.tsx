import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import s from './index.module.less';
import Modal from '@/components/library/Modal';
import Form, { FormRef } from '@/components/library/Form';
import {
  KYCStatus,
  FileInfo,
  InternalConsumerUser,
  InternalBusinessUser,
  Comment,
  KYCAndUserStatusChangeReason,
  UserUpdateRequest,
  KYCStatusDetailsInternal,
} from '@/apis';
import { useApi } from '@/api';
import { CloseMessage, message } from '@/components/library/Message';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import TextArea from '@/components/library/TextArea';
import NarrativesSelectStatusChange from '@/pages/case-management/components/NarrativesSelectStatusChange';
import { KYC_AND_USER_STATUS_CHANGE_REASONS } from '@/apis/models-custom/KYCAndUserStatusChangeReason';
import { USER_AUDIT_LOGS_LIST } from '@/utils/queries/keys';
import FilesDraggerInput from '@/components/ui/FilesDraggerInput';
import Label from '@/components/library/Label';
import { KYC_STATUSS } from '@/apis/models-custom/KYCStatus';
import { humanizeKYCStatus } from '@/components/utils/humanizeKYCStatus';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  user: InternalConsumerUser | InternalBusinessUser;
  onOkay: (kycStatus: KYCStatus | '', comment: Comment) => void;
}

interface FormValues {
  kycStatus: KYCStatus | '';
  reason: KYCAndUserStatusChangeReason | '';
  otherReason: string | undefined;
  comment: string;
  files: FileInfo[];
}
const DEFAULT_INITIAL_VALUES: FormValues = {
  kycStatus: '',
  reason: '',
  otherReason: undefined,
  comment: '',
  files: [],
};
export default function KYCChangeModal(props: Props) {
  const { title, isVisible, onClose, user, onOkay } = props;
  const settings = useSettings();
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
  const [presentKycStatus, setpresentKycStatus] = useState<string>('');
  const [statusChangeReasons, setStatusChangeReasons] = useState<KYCAndUserStatusChangeReason[]>(
    KYC_AND_USER_STATUS_CHANGE_REASONS,
  );

  useEffect(() => {
    setFormState((prevState) => ({
      ...prevState,
      values: {
        ...prevState.values,
        files: fileList,
      },
    }));
  }, [fileList]);

  useEffect(() => {
    if (presentKycStatus === 'SUCCESSFUL') {
      setStatusChangeReasons(['Other']);
    } else {
      setStatusChangeReasons(KYC_AND_USER_STATUS_CHANGE_REASONS);
    }
  }, [presentKycStatus]);
  const api = useApi();

  let messageLoading: CloseMessage | undefined;

  const queryClient = useQueryClient();
  const mutation = useMutation(
    async (values: FormValues) => {
      const { files, comment, otherReason, reason, kycStatus } = values;
      messageLoading = message.loading('Changing KYC Status...');
      const newStateDetails: KYCStatusDetailsInternal = {
        status: kycStatus === '' ? undefined : kycStatus,
        reason: reason === 'Other' && otherReason ? otherReason : reason,
      };
      const commentText = comment;
      const commentContent = {
        Comment: {
          body: commentText,
          files: files,
        },
      };

      let updatedComment: Comment | undefined;

      const payload: UserUpdateRequest = {
        kycStatusDetails: newStateDetails,
        comment: commentContent.Comment,
      };

      if (user.type === 'CONSUMER') {
        await api.postUserApprovalProposal({
          userId: user.userId,
          UserApprovalUpdateRequest: {
            proposedChanges: [
              {
                field: 'kycStatusDetails',
                value: newStateDetails,
              },
            ],
            comment: commentText,
          },
        });
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
      return { kycStatus, updatedComment };
    },
    {
      onSuccess: async (data) => {
        message.success('KYC status updated successfully');
        ref.current?.setValues(DEFAULT_INITIAL_VALUES);
        onOkay(data.kycStatus, data.updatedComment);
        onClose();
        messageLoading?.();
        await queryClient.invalidateQueries(USER_AUDIT_LOGS_LIST(user.userId, {}));
      },
      onError: (error: Error) => {
        message.error(`Error Changing KYC Status: ${error.message}`);
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
        onCancel={() => {
          onClose();
        }}
        isOpen={isVisible}
        onOk={() => {
          setAlwaysShowErrors(true);
          if (formState.isValid) {
            mutation.mutate(formState.values);
          }
        }}
        writeResources={['write:::users/user-overview/*']}
      >
        <Form<FormValues>
          initialValues={DEFAULT_INITIAL_VALUES}
          ref={ref}
          onChange={(formValue) => {
            setFormState(formValue);
            setpresentKycStatus(formValue?.values?.kycStatus);
          }}
          fieldValidators={{
            kycStatus: notEmpty,
            reason: notEmpty,
            otherReason: isOtherReason ? notEmpty : undefined,
            comment: notEmpty,
          }}
          alwaysShowErrors={alwaysShowErrors}
        >
          <InputField<FormValues, 'kycStatus'>
            name="kycStatus"
            label="KYC status"
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
                options={KYC_STATUSS.map((kycStatus: KYCStatus) => ({
                  label: humanizeKYCStatus(kycStatus, settings.kycStatusAlias),
                  value: kycStatus,
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
                options={statusChangeReasons.map((reason: KYCAndUserStatusChangeReason) => ({
                  label: reason,
                  value: reason,
                }))}
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
                    placeholder={`Write a narrative explaining the KYC Status change reason and findings, if any.`}
                  />
                </>
              )}
            </InputField>
          </div>
          <Label label={'Upload attachments'}>
            <FilesDraggerInput
              value={fileList}
              onChange={(value) => {
                setFileList(value ?? []);
              }}
            />
          </Label>
        </Form>
      </Modal>
    </>
  );
}
