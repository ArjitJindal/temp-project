import React, { useCallback, useEffect, useRef, useState } from 'react';
import _ from 'lodash';
import pluralize from 'pluralize';
import { UseMutationResult } from '@tanstack/react-query';
import { statusToOperationName } from './StatusChangeButton';
import NarrativesSelectStatusChange from './NarrativesSelectStatusChange';
import s from './index.module.less';
import { CopilotButtonContent } from './Copilot/CopilotButtonContent';
import { CaseStatus, FileInfo } from '@/apis';
import { CaseClosingReasons } from '@/apis/models/CaseClosingReasons';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import Modal from '@/components/library/Modal';
import Form, { FormRef, InputProps } from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import TextInput from '@/components/library/TextInput';
import { MAX_COMMENT_LENGTH } from '@/components/CommentEditor';
import TextArea from '@/components/library/TextArea';
import Checkbox from '@/components/library/Checkbox';
import Alert from '@/components/library/Alert';
import { and } from '@/components/library/Form/utils/validation/combinators';
import { maxLength, notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import GenericFormField from '@/components/library/Form/GenericFormField';
import { useFinishedSuccessfully } from '@/utils/asyncResource';
import { getMutationAsyncResource } from '@/utils/queries/hooks';
import { useDeepEqualEffect } from '@/utils/hooks';
import FilesInput, { RemoveAllFilesRef } from '@/components/ui/FilesInput';

export const OTHER_REASON: CaseClosingReasons = 'Other';
export const COMMON_REASONS = [OTHER_REASON];
// todo: need to take from tenant storage when we implement it
export const CLOSING_REASONS: CaseClosingReasons[] = [
  'False positive',
  'Investigation completed',
  'Documents collected',
  'Suspicious activity reported (SAR)',
  'Documents not collected',
  'Transaction Refunded',
  'Transaction Rejected',
  'User Blacklisted',
  'User Terminated',
  'Escalated',
];

export const ESCALATION_REASONS: CaseClosingReasons[] = [
  'Fraud',
  'Anti-money laundering',
  'Terrorist financing',
];

export interface FormValues {
  reasons: CaseClosingReasons[];
  reasonOther: string | undefined;
  comment: string | undefined;
  files: FileInfo[];
  closeRelatedCase: boolean;
}

export interface Props {
  entityName: string;
  isVisible: boolean;
  entityIds: string[];
  newStatus: CaseStatus;
  newStatusActionLabel?: 'Send back' | 'Escalate' | 'Approve' | 'Decline';
  defaultReasons?: CaseClosingReasons[];
  initialValues?: FormValues;
  onSaved: () => void;
  onClose: () => void;
  updateMutation: UseMutationResult<unknown, unknown, FormValues>;
  displayCloseRelatedCases?: boolean;
  skipReasonsModal?: boolean;
}

const DEFAULT_INITIAL_VALUES: FormValues = {
  reasons: [],
  reasonOther: undefined,
  comment: '',
  files: [],
  closeRelatedCase: false,
};

const uploadedFiles: FileInfo[] = [];

const handleFiles = (files: FileInfo[]) => {
  return _.uniqBy([...files, ...uploadedFiles], 's3Key');
};

export default function StatusChangeModal(props: Props) {
  const {
    entityIds,
    entityName,
    newStatus,
    isVisible,
    defaultReasons,
    initialValues = {
      ...DEFAULT_INITIAL_VALUES,
      defaultReasons,
    },
    onSaved,
    onClose,
    updateMutation,
    newStatusActionLabel,
    displayCloseRelatedCases,
    skipReasonsModal = false,
  } = props;
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const [isAwaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: initialValues,
    isValid: false,
  });
  const [uploadingCount, setUploadingCount] = useState(0);
  const [fileList, setFileList] = useState<FileInfo[]>(initialValues.files);
  const formRef = useRef<FormRef<FormValues>>(null);
  const showCopilot = useFeatureEnabled('COPILOT');
  const showConfirmation =
    isVisible && (newStatus === 'REOPENED' || isAwaitingConfirmation || skipReasonsModal);

  useEffect(() => {
    if (uploadingCount === 0) {
      uploadedFiles.splice(0, uploadedFiles.length);
    }
  }, [uploadingCount]);

  useDeepEqualEffect(() => {
    formRef.current?.setValues(initialValues);
    formRef.current?.validate();
  }, [initialValues]);

  useEffect(() => {
    setFormState((prevState) => ({
      ...prevState,
      values: {
        ...prevState.values,
        files: fileList,
      },
    }));
  }, [fileList]);

  const possibleReasons: CaseClosingReasons[] = [
    ...(newStatus === 'ESCALATED' ? ESCALATION_REASONS : CLOSING_REASONS),
    ...COMMON_REASONS,
  ];
  const modalTitle = `${newStatusActionLabel ?? statusToOperationName(newStatus)} ${pluralize(
    entityName,
    entityIds.length,
    true,
  )}`;

  const uploadRef = useRef<RemoveAllFilesRef>(null);

  const removeFiles = useCallback(() => {
    setFormState((prevState) => ({
      ...prevState,
      files: [],
    }));
    uploadRef.current?.removeAllFiles();
  }, []);

  const updateRes = getMutationAsyncResource(updateMutation);
  const isFinishedSuccessfully = useFinishedSuccessfully(updateRes);
  useEffect(() => {
    if (isFinishedSuccessfully) {
      removeFiles();
      formRef.current?.setValues(initialValues);
      onClose();
      onSaved();
    }
  }, [isFinishedSuccessfully, removeFiles, initialValues, onSaved, onClose]);

  const alertMessage =
    newStatusActionLabel === 'Send back'
      ? 'Please note that a case/alert will be reassigned to a previous assignee if available or else it will be assigned to the account that escalated the case/alert.'
      : null;

  const isOtherReason = formState.values.reasons?.includes(OTHER_REASON) ?? false;
  const handleConfirm = useCallback(() => {
    updateMutation.mutate({
      ...formState.values,
      comment: formState.values.comment?.trim(),
      reasonOther: formState.values.reasonOther?.trim(),
    });
  }, [formState, updateMutation]);

  return (
    <>
      <Modal
        title={modalTitle}
        isOpen={isVisible && !showConfirmation}
        okProps={{
          isLoading: updateMutation.isLoading,
        }}
        width="S"
        okText="Confirm"
        onOk={() => {
          formRef?.current?.submit();
        }}
        onCancel={() => {
          removeFiles();
          onClose();
        }}
      >
        <Form<FormValues>
          ref={formRef}
          initialValues={initialValues}
          className={s.root}
          onSubmit={(_, state) => {
            setAlwaysShowErrors(true);
            if (state.isValid) {
              setAwaitingConfirmation(true);
            }
          }}
          fieldValidators={{
            reasons: notEmpty,
            comment: and([notEmpty, maxLength(MAX_COMMENT_LENGTH)]),
            reasonOther: isOtherReason ? and([notEmpty, maxLength(500)]) : undefined,
          }}
          onChange={setFormState}
          alwaysShowErrors={alwaysShowErrors}
        >
          <InputField<FormValues, 'reasons'>
            name={'reasons'}
            label={'Reason'}
            labelProps={{
              required: {
                value: true,
                showHint: true,
              },
            }}
          >
            {(inputProps: InputProps<CaseClosingReasons[]>) => (
              <Select<CaseClosingReasons>
                {...inputProps}
                mode="MULTIPLE"
                options={possibleReasons.map((label) => ({ value: label, label }))}
              />
            )}
          </InputField>
          {isOtherReason && (
            <InputField<FormValues, 'reasonOther'>
              name="reasonOther"
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
                    placeholder={`Write a narrative explaining the ${entityName} closure reason and findings, if any.`}
                  />
                </>
              )}
            </InputField>
            {showCopilot && (
              <GenericFormField<FormValues, 'comment'> name="comment">
                {(props) => (
                  <CopilotButtonContent
                    reasons={formState.values.reasons ?? []}
                    setCommentValue={(value) => {
                      props.onChange?.(value);
                    }}
                    caseId={entityIds[0]}
                  />
                )}
              </GenericFormField>
            )}
          </div>
          <InputField<FormValues, 'files'> name={'files'} label={'Attach documents'}>
            {(inputProps) => (
              <FilesInput
                {...inputProps}
                ref={uploadRef}
                onChange={(value) => {
                  setFileList(handleFiles([...(value ?? [])]));
                }}
                value={fileList}
                uploadingCount={uploadingCount}
                setUploadingCount={setUploadingCount}
                uploadedFiles={uploadedFiles}
              />
            )}
          </InputField>
          {displayCloseRelatedCases && newStatus === 'ESCALATED' && (
            <InputField<FormValues, 'closeRelatedCase'>
              name={'closeRelatedCase'}
              label={`Close related ${entityName === 'alert' ? 'cases' : 'alerts'}`}
              labelProps={{
                position: 'RIGHT',
              }}
            >
              {(inputProps) => <Checkbox {...inputProps} />}
            </InputField>
          )}
          {alertMessage && <Alert type="info">{alertMessage}</Alert>}
        </Form>
      </Modal>
      <Modal
        title="ⓘ Confirm action"
        isOpen={showConfirmation}
        okProps={{
          isDisabled: updateMutation.isLoading,
        }}
        okText="Confirm"
        onOk={handleConfirm}
        onCancel={() => {
          removeFiles();
          setAwaitingConfirmation(false);
          onClose();
        }}
      >
        Are you sure you want to <b>{newStatusActionLabel ?? statusToOperationName(newStatus)}</b>{' '}
        {pluralize(entityName, entityIds.length, true)} <b>{entityIds.join(', ')}</b> ?
      </Modal>
    </>
  );
}
