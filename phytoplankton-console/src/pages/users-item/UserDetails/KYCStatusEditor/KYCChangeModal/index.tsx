import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import s from './index.module.less';
import Modal from '@/components/library/Modal';
import Form, { FormRef } from '@/components/library/Form';
import { KYCStatus, FileInfo, InternalConsumerUser, InternalBusinessUser, Comment } from '@/apis';
import { KYC_STATUSES } from '@/utils/api/users';
import FilesInput, { RemoveAllFilesRef } from '@/components/ui/FilesInput';
import { useApi } from '@/api';
import { CloseMessage, message } from '@/components/library/Message';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import { humanizeConstant } from '@/utils/humanize';
import TextArea from '@/components/library/TextArea';
import NarrativesSelectStatusChange from '@/pages/case-management/components/NarrativesSelectStatusChange';
interface Props {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  user: InternalConsumerUser | InternalBusinessUser;
  onOkay: (kycStatus: KYCStatus | '', comment: Comment) => void;
}
type Reasons =
  | 'Fake document'
  | 'Blurry document'
  | 'Suspected fraud'
  | 'Adverse media'
  | 'PEP'
  | 'Sanctions hit'
  | 'Risky profile'
  | 'Other';

const InitialReasonsObject: Reasons[] = [
  'Fake document',
  'Blurry document',
  'Suspected fraud',
  'Adverse media',
  'PEP',
  'Sanctions hit',
  'Risky profile',
  'Other',
];
interface FormValues {
  kycStatus: KYCStatus | '';
  reason: Reasons | '';
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
  const [uploadingCount, setUploadingCount] = useState(0);
  const [fileList, setFileList] = useState<FileInfo[]>(DEFAULT_INITIAL_VALUES.files);
  const ref = useRef<FormRef<FormValues>>(null);
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: DEFAULT_INITIAL_VALUES,
    isValid: false,
  });
  const [presentKycStatus, setpresentKycStatus] = useState<string>('');
  const [StatusChangeReasons, setStatusChangeReasons] = useState<Reasons[]>(InitialReasonsObject);
  const uploadRef = useRef<RemoveAllFilesRef>(null);
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
  const removeFiles = useCallback(() => {
    setFormState((prevState) => ({
      ...prevState,
      files: [],
    }));
    uploadRef.current?.removeAllFiles();
  }, []);
  const api = useApi();

  useEffect(() => {
    if (presentKycStatus === 'SUCCESSFUL') setStatusChangeReasons(['Other']);
    else {
      setStatusChangeReasons(InitialReasonsObject);
    }
  }, [presentKycStatus]);

  let messageLoading: CloseMessage | undefined;
  const mutation = useMutation(
    async (values: FormValues) => {
      const { files, comment, otherReason, reason, kycStatus } = values;
      messageLoading = message.loading('Changing KYC Status...');
      const newStateDetails = {
        status: kycStatus === '' ? undefined : kycStatus,
        reason: reason === 'Other' ? otherReason : reason,
      };
      const commentText = ` ${`KYC Status:${kycStatus}`}. Reason: ${
        reason === 'Other' ? otherReason : reason
      } \n${comment}`;
      const commentContent = {
        Comment: {
          body: commentText,
          files: files,
        },
      };
      const params = {
        userId: user.userId,
        UserUpdateRequest: {
          kycStatusDetails: newStateDetails,
          comment: commentContent.Comment,
        },
      };
      let updatedComment: Comment | undefined;
      if (user.type === 'CONSUMER') {
        updatedComment = await api.postConsumerUsersUserId(params);
      } else {
        updatedComment = await api.postBusinessUsersUserId(params);
      }
      return { kycStatus, updatedComment };
    },
    {
      onSuccess: (data) => {
        message.success(`KYC status updated`);
        ref.current?.setValues(DEFAULT_INITIAL_VALUES);
        onOkay(data.kycStatus, data.updatedComment);
        removeFiles();
        onClose();
        messageLoading?.();
      },
      onError: (error) => {
        message.error(`Error Changing KYC Status: ${(error as Error).message}`);
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
          removeFiles();
        }}
        isOpen={isVisible}
        onOk={() => {
          setAlwaysShowErrors(true);
          if (formState.isValid) {
            mutation.mutate(formState.values);
          }
        }}
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
                options={KYC_STATUSES.map((kycStatus: KYCStatus) => ({
                  label: humanizeConstant(kycStatus),
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
                options={StatusChangeReasons.map((reason: Reasons) => ({
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
          <InputField<FormValues, 'files'> name={'files'} label={'Upload'}>
            {(inputProps) => (
              <FilesInput
                {...inputProps}
                ref={uploadRef}
                onChange={(value) => {
                  setFileList(value ?? []);
                }}
                value={fileList}
                uploadingCount={uploadingCount}
                setUploadingCount={setUploadingCount}
              />
            )}
          </InputField>
        </Form>
      </Modal>
    </>
  );
}
