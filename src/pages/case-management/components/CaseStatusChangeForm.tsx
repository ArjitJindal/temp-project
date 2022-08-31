import React, { useCallback, useState } from 'react';
import { Form, Input, message, Modal, Select } from 'antd';
import { useApi } from '@/api';
import { CaseStatus } from '@/apis';
import Button from '@/components/ui/Button';

interface Props {
  transactionId: string;
  newCaseStatus: CaseStatus;
  onSaved: () => void;
}

interface CasesProps {
  transactionIds: string[];
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
  reasons: string[];
  reasonOther: string | null;
}

export function CaseStatusChangeForm(props: Props) {
  const { transactionId, onSaved, newCaseStatus } = props;
  const [isModalVisible, setModalVisible] = useState(false);
  const [isOtherReason, setIsOtherReason] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const api = useApi();

  const reopenCase = useCallback(async () => {
    const hideMessage = message.loading(`Saving...`, 0);
    try {
      setSaving(true);
      await api.postTransactions({
        TransactionsUpdateRequest: {
          transactionIds: [transactionId],
          transactionUpdates: {
            caseStatus: newCaseStatus,
          },
        },
      });
      message.success('Case Reopened');
      setModalVisible(false);
      onSaved();
    } catch (e) {
      message.error('Failed to save');
    } finally {
      hideMessage();
      setSaving(false);
    }
  }, [onSaved, transactionId, api, newCaseStatus]);

  const handleUpdateTransaction = useCallback(
    async (values: FormValues) => {
      const hideMessage = message.loading(`Saving...`, 0);
      try {
        setSaving(true);
        await api.postTransactions({
          TransactionsUpdateRequest: {
            transactionIds: [transactionId],
            transactionUpdates: {
              caseStatus: newCaseStatus,
              reason: values.reasons.map((x) => {
                if (x === OTHER_REASON) {
                  return values.reasonOther ?? '';
                }
                return x;
              }),
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
    [onSaved, transactionId, api, newCaseStatus],
  );

  const possibleReasons = [...COMMON_REASONS, ...CLOSING_REASONS];
  // todo: i18n
  return (
    <>
      <Button
        analyticsName="UpdateCaseStatus"
        onClick={() => {
          if (newCaseStatus === 'CLOSED') {
            setModalVisible(true);
          } else {
            reopenCase();
          }
        }}
      >
        {caseStatusToOperationName(newCaseStatus)}
      </Button>
      <Modal
        title="Update case status"
        visible={isModalVisible}
        okButtonProps={{
          disabled: isSaving,
        }}
        onOk={() => {
          form
            .validateFields()
            .then((values) => {
              return handleUpdateTransaction(values);
              // onCreate(values);
            })
            .then(() => {
              form.resetFields();
              setIsOtherReason(false);
            })
            .catch((info) => {
              console.log('Validate Failed:', info);
            });
        }}
        onCancel={() => {
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
        </Form>
      </Modal>
    </>
  );
}

export function CasesStatusChangeForm(props: CasesProps) {
  const { transactionIds, onSaved, newCaseStatus } = props;
  const [isModalVisible, setModalVisible] = useState(false);
  const [isOtherReason, setIsOtherReason] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const [isAwaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [formValues, setFormValues] = useState<FormValues>();
  const api = useApi();

  const reopenCase = useCallback(async () => {
    const hideMessage = message.loading(`Saving...`, 0);
    try {
      setSaving(true);
      await api.postTransactions({
        TransactionsUpdateRequest: {
          transactionIds,
          transactionUpdates: {
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
  }, [onSaved, transactionIds, api, newCaseStatus]);

  const handleUpdateTransaction = useCallback(
    async (values: FormValues) => {
      const hideMessage = message.loading(`Saving...`, 0);
      try {
        setSaving(true);
        await api.postTransactions({
          TransactionsUpdateRequest: {
            transactionIds,
            transactionUpdates: {
              caseStatus: newCaseStatus,
              reason: values.reasons.map((x) => {
                if (x === OTHER_REASON) {
                  return values.reasonOther ?? '';
                }
                return x;
              }),
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
    [onSaved, transactionIds, api, newCaseStatus],
  );

  const possibleReasons = [...COMMON_REASONS, ...CLOSING_REASONS];
  // todo: i18n
  const modalTitle =
    transactionIds.length == 1 ? 'Close case' : `Close ${transactionIds.length}  cases`;
  const modalMessagePrefix = 'Are you sure you want to';
  const modalMessageSuffix =
    `${transactionIds.length} case` + (transactionIds.length == 1 ? '?' : 's?');

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
        disabled={!transactionIds.length}
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
        {modalMessagePrefix} <b>{caseStatusToOperationName(newCaseStatus)}</b> {modalMessageSuffix}
      </Modal>
    </>
  );
}
