import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Form, Input, Modal, Select } from 'antd';
import pluralize from 'pluralize';
import { UseMutationResult } from '@tanstack/react-query';
import _ from 'lodash';
import { statusToOperationName } from './StatusChangeButton';
import NarrativesSelectStatusChange from './NarrativesSelectStatusChange';
import { CaseStatus, FileInfo } from '@/apis';
import { CaseClosingReasons } from '@/apis/models/CaseClosingReasons';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { useDeepEqualEffect, usePrevious } from '@/utils/hooks';
import { MAX_COMMENT_LENGTH } from '@/components/CommentEditor';
import TextArea from '@/components/library/TextArea';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { CopilotButtonContent } from '@/pages/case-management/components/Copilot/CopilotButtonContent';
import Alert from '@/components/library/Alert';
import Checkbox from '@/components/library/Checkbox';

export interface RemoveAllFilesRef {
  removeAllFiles: () => void;
}

export const OTHER_REASON = 'Other';
export const COMMON_REASONS = [OTHER_REASON];
// todo: need to take from tenant storage when we implement it
export const CLOSING_REASONS = [
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
  reasonOther: string | null;
  comment: string | null;
  files: FileInfo[];
  closeRelatedCase: boolean;
}

export interface Props {
  entityName: string;
  isVisible: boolean;
  entityIds: string[];
  newStatus: CaseStatus;
  newStatusActionLabel?: 'Send back' | 'Escalate';
  defaultReasons?: CaseClosingReasons[];
  initialValues?: FormValues;
  onSaved: () => void;
  onClose: () => void;
  updateMutation: UseMutationResult<unknown, unknown, FormValues>;
  displayCloseRelatedCases?: boolean;
}

let uploadedFiles: FileInfo[] = [];

const handleFiles = (files: FileInfo[]) => {
  return _.uniqBy([...uploadedFiles, ...files], 's3Key');
};

export default function StatusChangeModal(props: Props) {
  const {
    entityIds,
    entityName,
    newStatus,
    isVisible,
    defaultReasons,
    initialValues = {
      reasons: defaultReasons ?? [],
      reasonOther: null,
      comment: '',
      files: [],
      closeRelatedCase: false,
    },
    onSaved,
    onClose,
    updateMutation,
    newStatusActionLabel,
    displayCloseRelatedCases,
  } = props;
  const [isOtherReason, setIsOtherReason] = useState(false);
  const [reasons, setReasons] = useState<CaseClosingReasons[]>([]);
  const [isAwaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(initialValues);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [form] = Form.useForm<FormValues>();
  const [fileList, setFileList] = useState<FileInfo[]>(initialValues.files);

  const showCopilot = useFeatureEnabled('COPILOT');

  const showConfirmation = isVisible && (newStatus === 'REOPENED' || isAwaitingConfirmation);

  useDeepEqualEffect(() => {
    form.setFieldsValue(initialValues);
    setFormValues(initialValues);
  }, [initialValues]);

  useEffect(() => {
    if (uploadingCount === 0) {
      uploadedFiles = [];
    }
  }, [uploadingCount]);

  const possibleReasons = [
    ...(newStatus === 'ESCALATED' ? ESCALATION_REASONS : CLOSING_REASONS),
    ...COMMON_REASONS,
  ];
  const modalTitle = `${newStatusActionLabel ?? statusToOperationName(newStatus)} ${pluralize(
    entityName,
    entityIds.length,
    true,
  )}`;

  const [narrative, setNarrative] = useState<string | undefined>(undefined);
  const [commentValue, setCommentValue] = useState<string | undefined>(undefined);
  const uploadRef = useRef<RemoveAllFilesRef>(null);

  const removeFiles = useCallback(() => {
    setFormValues((prevState) => ({
      ...prevState,
      files: [],
    }));
    uploadRef.current?.removeAllFiles();
  }, []);

  const wasUpdateDone = usePrevious(updateMutation.isSuccess);
  const isUpdateDone = updateMutation.isSuccess;
  useEffect(() => {
    if (!wasUpdateDone && isUpdateDone) {
      removeFiles();
      form.resetFields();
      setReasons([]);
      setIsOtherReason(false);
      setAwaitingConfirmation(false);
      onClose();
      onSaved();
    }
  }, [wasUpdateDone, isUpdateDone, removeFiles, onSaved, onClose, form]);

  const handleConfirm = () => {
    updateMutation.mutate({
      ...formValues,
      files: handleFiles([...fileList, ...formValues.files]),
      comment: commentValue?.trim() || null,
    });
  };

  useEffect(() => {
    if (narrative) {
      setCommentValue(narrative);
      setNarrative(undefined);
    }
  }, [narrative]);

  const alertMessage =
    newStatusActionLabel === 'Send back'
      ? 'Please note that a case/alert will be reassigned to a previous assignee if available or else it will be assigned to the account that escalated the case/alert.'
      : null;

  return (
    <>
      <Modal
        title={modalTitle}
        visible={isVisible && !showConfirmation}
        okButtonProps={{
          disabled: updateMutation.isLoading,
        }}
        okText="Confirm"
        onOk={() => {
          form.validateFields().then((values) => {
            removeFiles();
            setFormValues(values);
            setAwaitingConfirmation(true);
          });
        }}
        onCancel={() => {
          removeFiles();
          setAwaitingConfirmation(false);
          onClose();
        }}
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          name="form_in_modal"
          initialValues={initialValues}
        >
          <Form.Item
            name="reasons"
            label="Reason"
            rules={[{ required: true, message: 'Please enter a Reason' }]}
          >
            <Select<string[]>
              mode="multiple"
              onChange={(value) => {
                // TODO is there a better way to get this state?
                // form.getValue did not work, neither did values.
                setReasons(value as CaseClosingReasons[]);
                setIsOtherReason(value.includes(OTHER_REASON));
              }}
            >
              {possibleReasons.map((label) => (
                <Select.Option key={label} value={label}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          {isOtherReason && (
            <Form.Item
              name="reasonOther"
              label="Describe the reason"
              rules={[{ required: true, message: 'Please describe the reason', max: 500 }]}
            >
              <Input />
            </Form.Item>
          )}
          <Form.Item name="comment" label="Comment" rules={[{ max: MAX_COMMENT_LENGTH }]}>
            <>
              <NarrativesSelectStatusChange
                templateValue={narrative}
                setTemplateValue={setNarrative}
              />
              <TextArea
                rows={4}
                placeholder={`Write a narrative explaining the ${entityName} closure reason and findings, if any.`}
                value={commentValue || ''}
                onChange={(comment) => {
                  setCommentValue(comment);
                }}
              />
            </>
          </Form.Item>
          {showCopilot && (
            <CopilotButtonContent
              reasons={reasons}
              setCommentValue={setCommentValue}
              caseId={entityIds[0]}
            />
          )}
          <Form.Item name="files" label="Attach documents">
            <FilesInput
              ref={uploadRef}
              onChange={(value) => setFileList(handleFiles([...fileList, ...value]))}
              value={fileList}
              uploadingCount={uploadingCount}
              setUploadingCount={setUploadingCount}
            />
          </Form.Item>
          {displayCloseRelatedCases && newStatus === 'ESCALATED' ? (
            <Form.Item name="closeRelatedCase">
              <Checkbox label="Close related cases" />
            </Form.Item>
          ) : undefined}
          {alertMessage ? (
            <Form.Item>
              <Alert type="info">{alertMessage}</Alert>
            </Form.Item>
          ) : null}
        </Form>
      </Modal>
      <Modal
        title="ⓘ Confirm action"
        visible={showConfirmation}
        okButtonProps={{
          disabled: updateMutation.isLoading,
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

const FilesInput = React.forwardRef(
  (
    props: {
      value?: FileInfo[];
      onChange?: (value: FileInfo[]) => void;
      uploadingCount: number;
      setUploadingCount: React.Dispatch<React.SetStateAction<number>>;
    },
    ref: React.Ref<RemoveAllFilesRef>,
  ) => {
    const { value = [], onChange } = props;

    return (
      <UploadFilesList
        files={value}
        onFileUploaded={async (file) => {
          uploadedFiles.push(file);
          onChange?.(handleFiles([file, ...value]));
        }}
        onFileRemoved={async (fileS3Key) => {
          onChange?.(value.filter((prevFile) => prevFile.s3Key !== fileS3Key));
        }}
        uploadingCount={props.uploadingCount}
        setUploadingCount={props.setUploadingCount}
        ref={ref}
      />
    );
  },
);
