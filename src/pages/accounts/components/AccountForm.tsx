import { useRef } from 'react';
import { message } from 'antd';
import { DrawerForm, ProFormInstance, ProFormSelect, ProFormText } from '@ant-design/pro-form';
import { PlusOutlined } from '@ant-design/icons';
import _ from 'lodash';
import Button from '@/components/ui/Button';
import { useApi } from '@/api';
import { UserRole } from '@/utils/user-utils';
import { Account } from '@/apis';

interface Props {
  editAccount: Account | null;
  onSuccess: () => void;
}
export default function AccountForm(props: Props) {
  const { editAccount, onSuccess } = props;
  const api = useApi();
  const formRef = useRef<ProFormInstance>();
  const isEdit = editAccount !== null;
  // todo: i18n
  const initialValues =
    editAccount != null
      ? editAccount
      : {
          email: '',
          role: 'user',
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
            await api.accountsPatch({
              accountId: editAccount?.id,
              AccountPatchPayload: {
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
        options={Object.keys(UserRole)
          .filter((key) => UserRole[key] !== UserRole.ROOT)
          .map((key) => ({
            value: UserRole[key],
            label: _.capitalize(key),
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
