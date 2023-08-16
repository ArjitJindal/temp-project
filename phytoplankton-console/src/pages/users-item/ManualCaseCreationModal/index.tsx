import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { CaseReasons, FileInfo } from '@/apis';
import Form, { FormRef } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import Modal from '@/components/library/Modal';
import Select from '@/components/library/Select';
import TextArea from '@/components/library/TextArea';
import TextInput from '@/components/library/TextInput';
import { OTHER_REASON } from '@/pages/case-management/components/StatusChangeModal';
import FilesInput, { RemoveAllFilesRef } from '@/components/ui/FilesInput';
import { useApi } from '@/api';
import { CloseMessage, message } from '@/components/library/Message';

type Props = {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  userId: string;
};

type FormValues = {
  reason?: CaseReasons;
  otherReason?: string;
  files: FileInfo[];
  comment?: string;
};

const INITIAL_VALUES: FormValues = {
  reason: undefined,
  otherReason: undefined,
  files: [],
  comment: undefined,
};

const MANUAL_CASE_CREATION_REASONSS: readonly CaseReasons[] = [
  'Internal referral',
  'External referral',
  'Other',
];

export const MannualCaseCreationModal = (props: Props) => {
  const { isOpen, setIsOpen } = props;
  const ref = useRef<FormRef<FormValues>>(null);
  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: INITIAL_VALUES,
    isValid: false,
  });
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const [uploadingCount, setUploadingCount] = useState(0);

  const isOtherReason = useMemo(() => {
    return formState.values.reason === OTHER_REASON;
  }, [formState.values.reason]);
  const [fileList, setFileList] = useState<FileInfo[]>(INITIAL_VALUES.files);

  const uploadRef = useRef<RemoveAllFilesRef>(null);
  const api = useApi();

  const removeFiles = useCallback(() => {
    setFormState((prevState) => ({
      ...prevState,
      files: [],
    }));
    uploadRef.current?.removeAllFiles();
  }, []);

  let messageLoading: CloseMessage | undefined;

  const mutation = useMutation(
    async (values: FormValues) => {
      const { files, comment, otherReason, reason } = values;
      messageLoading = message.loading('Creating case...');
      const case_ = await api.postCasesManual({
        ManualCaseCreationDataRequest: {
          manualCaseData: {
            comment,
            reason: reason ? [reason] : [],
            otherReason,
            userId: props.userId,
            timestamp: Date.now(),
          },
          files: files?.length ? files : [],
        },
      });

      return case_;
    },
    {
      onSuccess: (data) => {
        message.success(`Case ${data.caseId} created successfully`);
        removeFiles();
        setIsOpen(false);
        messageLoading?.();
      },
      onError: (error) => {
        message.error(`Error creating case: ${(error as Error).message}`);
        messageLoading?.();
      },
    },
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

  return (
    <Modal
      isOpen={isOpen}
      onCancel={() => {
        setIsOpen(false);
      }}
      title="Create manual case"
      width="S"
      onOk={() => {
        setAlwaysShowErrors(true);

        if (formState.isValid) {
          mutation.mutate(formState.values);
        }
      }}
      okText="Create"
    >
      <Form<FormValues>
        initialValues={INITIAL_VALUES}
        ref={ref}
        onChange={setFormState}
        fieldValidators={{
          reason: notEmpty,
          comment: notEmpty,
          otherReason: isOtherReason ? notEmpty : undefined,
        }}
        alwaysShowErrors={alwaysShowErrors}
      >
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
              options={MANUAL_CASE_CREATION_REASONSS.map((reason: CaseReasons) => ({
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
              <TextArea
                {...inputProps}
                rows={4}
                placeholder={`Write a narrative explaining the reason for creating a manual case.`}
              />
            </>
          )}
        </InputField>
        <InputField<FormValues, 'files'> name={'files'} label={'Attach documents'}>
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
  );
};
