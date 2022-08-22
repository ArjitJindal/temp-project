import React, { useRef, useState } from 'react';
import { Form, message } from 'antd';
import { DrawerForm, ProFormInstance, ProFormText } from '@ant-design/pro-form';
import { PlusOutlined } from '@ant-design/icons';
import defaultSettings from '@ant-design/pro-layout/lib/defaultSettings';
import Button from '@/components/ui/Button';
import { useApi } from '@/api';

interface Props {
  onClose: () => void;
}
export default function AccountInviteForm(props: Props) {
  const { onClose } = props;
  const api = useApi();
  const formRef = useRef<ProFormInstance>();
  const errorMessage =
    'Password must be 10-14 characters and should have at least 1 symbol (-,_,__,@#$%^&*!), one uppercase character, one lowercase character and one number';
  // todo: i18n
  return (
    <DrawerForm
      title="Invite user"
      width={400}
      formRef={formRef}
      trigger={
        <Button type="primary" name="Invite button">
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
            AccountInvitePayload: {
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
            message: 'Please enter the E-mail',
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
            message: 'Please enter the Password',
          },
          {
            validator(rule, value, callback) {
              if (!value.match(/^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{10,}$/)) {
                return Promise.reject(errorMessage);
              }
              return Promise.resolve();
            },
          },
        ]}
      />
    </DrawerForm>
  );
}
