import React, { useRef } from 'react';
import { message } from 'antd';
import { DrawerForm, ProFormInstance, ProFormSelect, ProFormText } from '@ant-design/pro-form';
import { PlusOutlined } from '@ant-design/icons';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import Button from '@/components/ui/Button';
import { useApi } from '@/api';
import { Account } from '@/apis';
import { ACCOUNT_ROLE_NAMES } from '@/apis/models-custom/AccountRoleName';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  editAccount: Account | null;
  onSuccess: () => void;
}
export default function AccountForm(props: Props) {
  const { editAccount, onSuccess } = props;
  const api = useApi();
  const formRef = useRef<ProFormInstance>();
  let roles = ['admin', 'user'];
  if (useFeatureEnabled('RBAC')) {
    roles = ACCOUNT_ROLE_NAMES.filter((name) => ['root', 'user'].indexOf(name) == -1);
  }

  const isEdit = editAccount !== null;
  // todo: i18n
  const initialValues =
    editAccount != null
      ? editAccount
      : {
          email: '',
          role: 'admin',
        };
  return (
    <DrawerForm<Account>
      initialValues={initialValues}
      title={isEdit ? 'Edit account' : 'Invite user'}
      width={400}
      formRef={formRef}
      trigger={
        <Button type={isEdit ? 'default' : 'primary'}>
          {!isEdit && <PlusOutlined />}
          {isEdit ? 'Edit' : 'Invite'}
        </Button>
      }
      submitter={{
        searchConfig: {
          resetText: 'Cancel',
          submitText: isEdit ? 'Save' : 'Invite',
        },
      }}
      autoFocusFirstInput
      onVisibleChange={(isVisible) => {
        if (isVisible) {
          formRef.current?.setFieldsValue(initialValues);
        }
      }}
      onFinish={async (values) => {
        if (isEdit) {
          try {
            await api.accountsChangeRole({
              accountId: editAccount?.id,
              ChangeRolePayload: {
                role: values.role,
              },
            });
            message.success('Account updated!');
            onSuccess();
            return true;
          } catch (e) {
            const error = e instanceof Response ? (await e.json())?.message : e;
            message.error(`Failed to update account - ${error}`, 10);
            return false;
          }
        } else {
          try {
            await api.accountsInvite({
              AccountInvitePayload: {
                email: values.email.trim(),
                role: values.role,
              },
            });
            message.success('User invited!');
            onSuccess();
            return true;
          } catch (e) {
            const error = e instanceof Response ? (await e.json())?.message : e;
            message.error(`Failed to invite user - ${error}`, 10);
            return false;
          }
        }
      }}
    >
      <ProFormText
        disabled={isEdit}
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
      <ProFormSelect
        width="md"
        name="role"
        label="Role"
        options={roles.map((name) => ({
          value: name,
          label: sentenceCase(name),
        }))}
        rules={[
          {
            required: true,
            message: 'Please select the role for a user',
          },
        ]}
      />
    </DrawerForm>
  );
}
