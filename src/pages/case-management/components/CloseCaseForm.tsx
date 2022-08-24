import React, { useCallback, useState } from 'react';
import { Form, Input, message, Modal, Select } from 'antd';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';

interface Props {
  transactionId: string;
  onSaved: () => void;
}

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

export default function CloseCaseForm(props: Props) {
  const { transactionId, onSaved } = props;
  const [isModalVisible, setModalVisible] = useState(false);
  const [isOtherReason, setIsOtherReason] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [form] = Form.useForm<FormValues>();
  const api = useApi();

  const handleUpdateTransaction = useCallback(
    async (values: FormValues) => {
      const hideMessage = message.loading(`Saving...`, 0);
      try {
        setSaving(true);
        await api.postTransactionsTransactionId({
          transactionId,
          TransactionUpdateRequest: {
            caseStatus: 'CLOSED',
            reason: values.reasons.map((x) => {
              if (x === OTHER_REASON) {
                return values.reasonOther ?? '';
              }
              return x;
            }),
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
    [onSaved, transactionId, api],
  );

  const possibleReasons = [...COMMON_REASONS, ...CLOSING_REASONS];
  // todo: i18n
  return (
    <>
      <Button
        analyticsName="CloseCase"
        onClick={() => {
          setModalVisible(true);
        }}
      >
        Close
      </Button>
      <Modal
        title="Close case"
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
