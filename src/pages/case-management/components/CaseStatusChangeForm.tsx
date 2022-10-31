import { useCallback, useState } from 'react';
import { Form, Input, message, Modal, Select } from 'antd';
import { useApi } from '@/api';
import { CaseStatus, FileInfo } from '@/apis';
import Button from '@/components/ui/Button';
import { CaseClosingReasons } from '@/apis/models/CaseClosingReasons';
import { UploadFilesList } from '@/components/files/UploadFilesList';

interface CasesProps {
  caseIds: string[];
  newCaseStatus: CaseStatus;
  onSaved: () => void;
}

const caseStatusToOperationName = (caseStatus: CaseStatus) => {
  if (caseStatus === 'REOPENED') {
    return 'Re-Open';
  } else if (caseStatus === 'CLOSED') {
    return 'Close';
  }
};

// todo: i18n
const OTHER_REASON = 'Other';
const COMMON_REASONS = [OTHER_REASON];
// todo: need to take from tenant storage when we implement it
const CLOSING_REASONS = [
  'False positive',
  'Investigation completed',
  'Documents collected',
  'Suspicious activity reported (SAR)',
  'Documents not collected',
  'Transaction Refunded',
  'Transaction Rejected',
  'User Blacklisted',
  'User Terminated',
];

interface FormValues {
  reasons: CaseClosingReasons[];
  reasonOther: string | null;
}

export function CasesStatusChangeForm(props: CasesProps) {
  const { caseIds, onSaved, newCaseStatus } = props;
  const [isModalVisible, setModalVisible] = useState(false);
  const [isOtherReason, setIsOtherReason] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [isAwaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const api = useApi();

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
      setModalVisible(false);
      onSaved();
    } catch (e) {
      message.error('Failed to save');
    } finally {
      hideMessage();
      setSaving(false);
    }
  }, [onSaved, caseIds, api, newCaseStatus]);

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
              files,
            },
          },
        });
        message.success('Saved');
        setModalVisible(false);
        onSaved();
      } catch (e) {
        message.error('Failed to save');
      } finally {
        hideMessage();
        setSaving(false);
      }
    },
    [api, caseIds, newCaseStatus, files, onSaved],
  );

  const possibleReasons = [...COMMON_REASONS, ...CLOSING_REASONS];
  // todo: i18n
  const modalTitle = caseIds.length == 1 ? 'Close case' : `Close ${caseIds.length}  cases`;
  const modalMessagePrefix = 'Are you sure you want to';
  const modalMessageSuffix = `${caseIds.length} case${caseIds.length == 1 ? ' :' : 's :'}`;
  const caseIdsString = caseIds.join(', ');

  return (
    <>
      <Button
        analyticsName="UpdateCaseStatus"
        onClick={() => {
          if (newCaseStatus === 'CLOSED') {
            setModalVisible(true);
          } else {
            setAwaitingConfirmation(true);
          }
        }}
        disabled={!caseIds.length || isSaving}
      >
        {caseStatusToOperationName(newCaseStatus)}
      </Button>
      <Modal
        title={modalTitle}
        visible={isModalVisible}
        okButtonProps={{
          disabled: isSaving,
        }}
        onOk={() => {
          form.validateFields().then((values) => {
            setFormValues(values);
            setAwaitingConfirmation(true);
            setModalVisible(false);
          });
        }}
        onCancel={() => {
          setAwaitingConfirmation(false);
          setModalVisible(false);
        }}
      >
        <Form<FormValues>
          form={form}
          layout="vertical"
          name="form_in_modal"
          initialValues={{
            reasons: [],
            reasonOther: null,
          }}
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
              rules={[{ required: true, message: 'Please describe the reason', max: 50 }]}
            >
              <Input />
            </Form.Item>
          )}
          <Form.Item name="documents" label="Attach documents">
            <UploadFilesList
              files={files}
              onFileUploaded={async (file) => {
                setFiles((prevFiles) => prevFiles.concat(file));
              }}
              onFileRemoved={async (fileS3Key) => {
                setFiles((prevFiles) =>
                  prevFiles.filter((prevFile) => prevFile.s3Key !== fileS3Key),
                );
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
      <Modal
        title="ⓘ Confirm action"
        visible={isAwaitingConfirmation}
        okButtonProps={{
          disabled: isSaving,
        }}
        okText="Confirm"
        onOk={() => {
          if (newCaseStatus === 'CLOSED') {
            handleUpdateTransaction(formValues as FormValues)
              .then(() => {
                form.resetFields();
                setIsOtherReason(false);
                setAwaitingConfirmation(false);
              })
              .catch((info) => {
                console.log('Failed to save ', info);
              });
          } else {
            reopenCase()
              .then(() => {
                setAwaitingConfirmation(false);
              })
              .catch(() => {
                console.log('Failed to re-open');
              });
          }
        }}
        onCancel={() => {
          setAwaitingConfirmation(false);
          setModalVisible(false);
        }}
      >
        {modalMessagePrefix} <b>{caseStatusToOperationName(newCaseStatus)}</b> {modalMessageSuffix}{' '}
        <b>{caseIdsString}</b> ?
      </Modal>
    </>
  );
}
