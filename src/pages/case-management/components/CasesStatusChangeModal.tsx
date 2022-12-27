import React, { useCallback, useRef, useState } from 'react';
import { Form, Input, message, Modal, Select } from 'antd';
import { useApi } from '@/api';
import { CaseStatus, FileInfo } from '@/apis';
import { CaseClosingReasons } from '@/apis/models/CaseClosingReasons';
import { UploadFilesList } from '@/components/files/UploadFilesList';
import { useDeepEqualEffect } from '@/utils/hooks';
import { getErrorMessage } from '@/utils/lang';

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

interface Props {
  isVisible: boolean;
  caseIds: string[];
  newCaseStatus: CaseStatus;
  defaultReasons?: CaseClosingReasons[];
  initialValues?: FormValues;
  onSaved: () => void;
  onClose: () => void;
}
export default function CasesStatusChangeModal(props: Props) {
  const {
    caseIds,
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
  } = props;
  const [isOtherReason, setIsOtherReason] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [isAwaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>(initialValues);
  const [form] = Form.useForm<FormValues>();
  const api = useApi();

  const showConfirmation = isVisible && (newCaseStatus === 'REOPENED' || isAwaitingConfirmation);

  useDeepEqualEffect(() => {
    form.setFieldsValue(initialValues);
    setFormValues(initialValues);
  }, [initialValues]);

  const reopenCase = useCallback(async () => {
    const hideMessage = message.loading(`Saving...`, 0);
    try {
      setSaving(true);
      await api.postCases({
        CasesUpdateRequest: {
          caseIds,
          updates: {
            caseStatus: newCaseStatus,
          },
        },
      });
      message.success('Cases Reopened');
      onClose();
      onSaved();
    } catch (e) {
      message.error('Failed to save');
    } finally {
      hideMessage();
      setSaving(false);
    }
  }, [onClose, onSaved, caseIds, api, newCaseStatus]);

  const handleUpdateTransaction = useCallback(
    async (values: FormValues) => {
      const hideMessage = message.loading(`Saving...`, 0);
      try {
        setSaving(true);
        await api.postCases({
          CasesUpdateRequest: {
            caseIds,
            updates: {
              caseStatus: newCaseStatus,
              otherReason:
                values.reasons.indexOf(OTHER_REASON) !== -1 ? values.reasonOther ?? '' : undefined,
              reason: values.reasons,
              files: values.files,
              comment: values.comment ?? undefined,
            },
          },
        });
        message.success('Saved');
        onClose();
        onSaved();
      } catch (e) {
        message.error('Failed to save');
      } finally {
        hideMessage();
        setSaving(false);
      }
    },
    [api, caseIds, newCaseStatus, onSaved, onClose],
  );

  const possibleReasons = [...COMMON_REASONS, ...CLOSING_REASONS];
  // todo: i18n
  const modalTitle = caseIds.length == 1 ? 'Close case' : `Close ${caseIds.length}  cases`;
  const modalMessagePrefix = 'Are you sure you want to';
  const modalMessageSuffix = `${caseIds.length} case${caseIds.length == 1 ? ' :' : 's :'}`;
  const caseIdsString = caseIds.join(', ');
  const uploadRef = useRef<RemoveAllFilesRef>(null);

  const removeFiles = useCallback(() => {
    setFormValues((prevState) => ({
      ...prevState,
      files: [],
    }));
    uploadRef.current?.removeAllFiles();
  }, []);

  return (
    <>
      <Modal
        title={modalTitle}
        visible={isVisible && !showConfirmation}
        okButtonProps={{
          disabled: isSaving,
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
          <Form.Item name="comment" label="Comment" rules={[{ max: 500 }]}>
            <Input.TextArea rows={2} />
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
          disabled: isSaving,
        }}
        okText="Confirm"
        onOk={() => {
          if (newCaseStatus === 'CLOSED') {
            handleUpdateTransaction(formValues as FormValues)
              .then(() => {
                removeFiles();
                form.resetFields();
                setIsOtherReason(false);
                setAwaitingConfirmation(false);
              })
              .catch((e) => {
                console.error(`Failed to save! ${getErrorMessage(e)}`);
              });
          } else {
            reopenCase()
              .then(() => {
                removeFiles();
                setAwaitingConfirmation(false);
              })
              .catch((e) => {
                console.error(`Failed to re-open! ${getErrorMessage(e)}`);
              });
          }
        }}
        onCancel={() => {
          removeFiles();
          setAwaitingConfirmation(false);
          onClose();
        }}
      >
        {modalMessagePrefix} <b>{caseStatusToOperationName(newCaseStatus)}</b> {modalMessageSuffix}{' '}
        <b>{caseIdsString}</b> ?
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
