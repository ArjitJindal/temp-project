import React, { useState } from 'react';
import { Button, Form, Input, Modal, Select } from 'antd';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Props {}

const REASONS = {
  FALSE_POSITIVE: 'False positive',
  INVESTIGATION_COMPLETED: 'Investigation completed',
  DOCUMENTS_COLLECTED: 'Documents collected',
  OTHER: 'Other',
};
type Reason = keyof typeof REASONS;

interface FormValues {
  reasons: Reason[];
  reason_other: string | null;
}

export default function AllowForm(props: Props) {
  const [isModalVisible, setModalVisible] = useState(false);
  const [isOtherReason, setIsOtherReason] = useState(false);
  const [form] = Form.useForm<FormValues>();

  // todo: i18n
  return (
    <>
      <Button
        onClick={() => {
          setModalVisible(true);
        }}
      >
        Allow
      </Button>
      <Modal
        title="Basic Modal"
        visible={isModalVisible}
        onOk={() => {
          form
            .validateFields()
            .then((values) => {
              form.resetFields();
              setIsOtherReason(false);
              console.log('values', values);
              // onCreate(values);
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
            reason_other: null,
          }}
        >
          <Form.Item name="reasons" label="Reason" rules={[{ required: true }]}>
            <Select<Reason[]>
              mode="multiple"
              onChange={(value) => setIsOtherReason(value.includes('OTHER'))}
            >
              {Object.entries(REASONS).map(([value, label]) => (
                <Select.Option key={value} value={value}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          {isOtherReason && (
            <Form.Item
              name="reason_other"
              label="Describe the reason"
              rules={[{ required: true, max: 50 }]}
            >
              <Input />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </>
  );
}
