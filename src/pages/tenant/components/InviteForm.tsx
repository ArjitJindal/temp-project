import React, { useRef } from 'react';
import { Button, message } from 'antd';
import { DrawerForm, ProFormInstance, ProFormText } from '@ant-design/pro-form';
import { PlusOutlined } from '@ant-design/icons';
import { useApi } from '@/api';

interface Props {
  onClose: () => void;
}

export default function InviteForm(props: Props) {
  const { onClose } = props;
  const api = useApi();
  const formRef = useRef<ProFormInstance>();
  // todo: i18n
  return (
    <DrawerForm
      title="Invite user"
      width={400}
      formRef={formRef}
      trigger={
        <Button type="primary">
          <PlusOutlined />
          Invite
        </Button>
      }
      submitter={{
        searchConfig: {
          resetText: 'Cancel',
          submitText: 'Invite',
        },
      }}
      autoFocusFirstInput
      onVisibleChange={(isVisible) => {
        if (!isVisible) {
          onClose();
        }
      }}
      onFinish={async (values) => {
        try {
          await api.accountsInvite({
            body: {
              email: values.email.trim(),
              password: values.password.trim(),
            },
          });
          message.success('User invited!');
          formRef.current?.resetFields();
          return true;
        } catch (e) {
          const error = e instanceof Response ? (await e.json())?.message : e;
          message.error(`Failed to invite user - ${error}`, 10);
          return false;
        }
      }}
    >
      <ProFormText
        width="md"
        name="email"
        label="E-mail"
        rules={[
          {
            required: true,
            type: 'email',
          },
        ]}
      />
      <ProFormText.Password
        width="md"
        name="password"
        label="Password"
        rules={[
          {
            required: true,
          },
        ]}
      />
    </DrawerForm>
  );
}
