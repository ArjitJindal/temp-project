import React, { useCallback, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { Form, FormInstance, Input, message, Switch } from 'antd';
import Icon from './icon-judge.react.svg';
import Modal from '@/components/ui/Modal';
import { useApi } from '@/api';
import { getErrorMessage } from '@/utils/lang';
import { ListType } from '@/apis';

interface Values {
  name: string;
  description: string;
  status: boolean;
}

interface Props {
  listType: ListType;
  isOpen: boolean;
  onCancel: () => void;
  onSuccess: () => void;
}

export default function NewListModal(props: Props) {
  const { isOpen, listType, onCancel, onSuccess } = props;

  const [form] = Form.useForm();
  const [formId] = useState(nanoid());

  const formRef = useRef<FormInstance>(null);

  const [isLoading, setLoading] = useState(false);
  const api = useApi();
  // todo: i18n
  const handleFinish = useCallback(
    (values: Values) => {
      setLoading(true);
      api
        .postList({
          listType,
          ListData: {
            metadata: {
              name: values.name,
              description: values.description,
              status: values.status,
            },
          },
        })
        .then(
          () => {
            message.success('List created');
            form.resetFields();
            onSuccess();
          },
          (e) => {
            message.error(`Unable to create list! ${getErrorMessage(e)}`);
          },
        )
        .finally(() => {
          setLoading(false);
        });
    },
    [form, onSuccess, listType, api],
  );

  const initialValues: Values = {
    name: '',
    description: '',
    status: false,
  };

  return (
    <Modal
      icon={<Icon />}
      title={'Add a New Whitelist'}
      isOpen={isOpen}
      onCancel={onCancel}
      okText={'Create'}
      okProps={{
        htmlType: 'submit',
        form: formId,
        loading: isLoading,
      }}
    >
      <Form<Values>
        form={form}
        id={formId}
        ref={formRef}
        layout="vertical"
        onFinish={handleFinish}
        initialValues={initialValues}
      >
        <Form.Item name="name" label="List name">
          <Input />
        </Form.Item>
        <Form.Item name="description" label="Description">
          <Input />
        </Form.Item>
        <Form.Item name="status" label="Status" valuePropName="checked">
          <Switch />
        </Form.Item>
      </Form>
    </Modal>
  );
}
