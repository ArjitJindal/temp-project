import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Form, Input, Modal, Select } from 'antd';
import pluralize from 'pluralize';
import { UseMutationResult } from '@tanstack/react-query';
import { CaseStatus, FileInfo } from '@/apis';
import { CaseClosingReasons } from '@/apis/models/CaseClosingReasons';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { useDeepEqualEffect, usePrevious } from '@/utils/hooks';
import { MAX_COMMENT_LENGTH } from '@/components/CommentEditor';

export interface RemoveAllFilesRef {
  removeAllFiles: () => void;
}

export const caseStatusToOperationName = (caseStatus: CaseStatus) => {
  if (caseStatus === 'REOPENED') {
    return 'Re-Open';
  } else if (caseStatus === 'CLOSED') {
    return 'Close';
  }
};

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

export interface FormValues {
  reasons: CaseClosingReasons[];
  reasonOther: string | null;
  comment: string | null;
  files: FileInfo[];
}

export interface Props {
  entityName?: string;
  isVisible: boolean;
  ids: string[];
  newCaseStatus: CaseStatus;
  defaultReasons?: CaseClosingReasons[];
  initialValues?: FormValues;
  onSaved: () => void;
  onClose: () => void;
  updateMutation: UseMutationResult<
    unknown,
    unknown,
    { ids: string[]; newCaseStatus: CaseStatus; formValues?: FormValues }
  >;
}

export default function StatusChangeModal(props: Props) {
  const {
    ids,
    entityName = 'case',
    newCaseStatus,
    isVisible,
    defaultReasons,
    initialValues = {
      reasons: defaultReasons ?? [],
      reasonOther: null,
      comment: '',
      files: [],
    },
    onSaved,
    onClose,
    updateMutation,
  } = props;
  const [isOtherReason, setIsOtherReason] = useState(false);
  const [isAwaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(initialValues);
  const [form] = Form.useForm<FormValues>();

  const showConfirmation = isVisible && (newCaseStatus === 'REOPENED' || isAwaitingConfirmation);

  useDeepEqualEffect(() => {
    form.setFieldsValue(initialValues);
    setFormValues(initialValues);
  }, [initialValues]);

  const possibleReasons = [...COMMON_REASONS, ...CLOSING_REASONS];
  const modalTitle = `Close ${pluralize(entityName, ids.length, true)}`;
  const caseIdsString = ids.join(', ');
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
      setIsOtherReason(false);
      setAwaitingConfirmation(false);
      onClose();
      onSaved();
    }
  }, [wasUpdateDone, isUpdateDone, removeFiles, onSaved, onClose, form]);

  const handleConfirm = () => {
    updateMutation.mutate({ ids: ids, newCaseStatus, formValues });
  };
  return (
    <>
      <Modal
        title={modalTitle}
        visible={isVisible && !showConfirmation}
        okButtonProps={{
          disabled: updateMutation.isLoading,
        }}
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
              onChange={(value) => setIsOtherReason(value.includes(OTHER_REASON))}
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
            <Input.TextArea
              rows={4}
              placeholder={`Write a narrative explaning the ${entityName} closure reason and findings, if any.`}
            />
          </Form.Item>
          <Form.Item name="files" label="Attach documents">
            <FilesInput ref={uploadRef} />
          </Form.Item>
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
        Are you sure you want to <b>{caseStatusToOperationName(newCaseStatus)}</b>{' '}
        {pluralize(entityName, ids.length, true)} <b>{caseIdsString}</b> ?
      </Modal>
    </>
  );
}

const FilesInput = React.forwardRef(
  (
    props: {
      value?: FileInfo[];
      onChange?: (value: FileInfo[]) => void;
    },
    ref: React.Ref<RemoveAllFilesRef>,
  ) => {
    const { value = [], onChange } = props;
    return (
      <UploadFilesList
        files={value}
        onFileUploaded={async (file) => {
          onChange?.([...value, file]);
        }}
        onFileRemoved={async (fileS3Key) => {
          onChange?.(value.filter((prevFile) => prevFile.s3Key !== fileS3Key));
        }}
        ref={ref}
      />
    );
  },
);
