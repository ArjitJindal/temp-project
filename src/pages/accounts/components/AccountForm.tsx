import React, { useMemo, useRef, useState } from 'react';
import { DrawerForm, ProFormInstance, ProFormSelect, ProFormText } from '@ant-design/pro-form';
import { PlusOutlined, EditOutlined } from '@ant-design/icons';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import { message } from '@/components/library/Message';
import Button from '@/components/library/Button';
import { useApi } from '@/api';
import { Account, AccountRole } from '@/apis';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import { ACCOUNT_LIST, ROLES_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { getErrorMessage } from '@/utils/lang';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { isSuccess } from '@/utils/asyncResource';
import { getBranding } from '@/utils/branding';
import { useApiTime } from '@/utils/tracker';
import { UserRole, parseUserRole } from '@/utils/user-utils';
import { P } from '@/components/ui/Typography';
import Close from '@/components/ui/icons/close.react.svg';

interface Props {
  editAccount: Account | null;
  onSuccess: () => void;
}
export default function AccountForm(props: Props) {
  const { editAccount, onSuccess } = props;
  const api = useApi();
  const measure = useApiTime();

  const formRef = useRef<ProFormInstance>();
  const [emailIsEmpty, setEmailIsEmpty] = useState(true);
  const rolesResp = useQuery<AccountRole[]>(ROLES_LIST(), async () => {
    return await api.getRoles();
  });
  const branding = getBranding();

  const settings = useSettings();
  const maxSeats = settings.limits?.seats;

  const isEdit = editAccount !== null;

  const accountsResult = usePaginatedQuery<Account>(ACCOUNT_LIST(), async () => {
    const accounts = await measure(() => api.getAccounts(), 'Get accounts');
    const filteredAccounts = accounts.filter(
      (account) => parseUserRole(account.role) !== UserRole.ROOT && !account.blocked,
    );

    return {
      items: filteredAccounts,
      success: true,
      total: filteredAccounts.length,
    };
  });
  // todo: i18n

  const isInviteDisabled = useMemo(() => {
    if (isEdit) {
      return false;
    }

    if (!isSuccess(accountsResult.data)) {
      return true;
    }

    if (!maxSeats) {
      return true;
    }

    const existingSeats = accountsResult.data.value?.total;

    if (existingSeats == null) {
      return true;
    }

    return existingSeats >= maxSeats;
  }, [accountsResult, maxSeats, isEdit]);

  const initialValues =
    editAccount != null
      ? editAccount
      : {
          email: '',
          role: 'admin',
        };
  const onFinish = async (values: Account) => {
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
        message.fatal(`Failed to update account - ${getErrorMessage(e)}`, e);
        return false;
      }
    }

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
      message.fatal(`Failed to invite user - ${getErrorMessage(e)}`, e);
      return false;
    }
  };

  return (
    <DrawerForm<Account>
      initialValues={initialValues}
      title={isEdit ? 'Edit account' : 'Invite user'}
      width={400}
      formRef={formRef}
      onChange={(e) => {
        if ((e?.target as HTMLInputElement)?.value) {
          setEmailIsEmpty(false);
        } else {
          setEmailIsEmpty(true);
        }
      }}
      trigger={
        <div>
          {isEdit ? (
            <div style={{ marginTop: '-0.2rem' }}>
              <EditOutlined />
            </div>
          ) : (
            <Button type="TETRIARY">
              <PlusOutlined />
              {'Invite'}
            </Button>
          )}
        </div>
      }
      disabled={isInviteDisabled}
      submitter={{
        searchConfig: {
          resetText: 'Cancel',
          submitText: isEdit ? 'Save' : 'Invite',
        },
        submitButtonProps: {
          disabled: !isEdit && emailIsEmpty,
        },
      }}
      autoFocusFirstInput
      onVisibleChange={(isVisible) => {
        if (isVisible) {
          formRef.current?.setFieldsValue(initialValues);
        }
      }}
      onFinish={onFinish}
      requiredMark={false}
      drawerProps={{
        closeIcon: (
          <div style={{ position: 'absolute', right: '1rem', top: '1rem', scale: '1.2' }}>
            <Close />
          </div>
        ),
        headerStyle: {
          marginLeft: '-1.5rem',
        },
      }}
    >
      <ProFormText
        disabled={isEdit}
        width="md"
        name="email"
        label="E-mail"
        allowClear={false}
        rules={[
          {
            required: true,
            type: 'email',
            message: 'Please enter the E-mail',
          },
        ]}
      />
      <AsyncResourceRenderer resource={rolesResp.data}>
        {(roles) => (
          <ProFormSelect
            width="md"
            name="role"
            label="Role"
            allowClear={false}
            options={roles.map((name) => ({
              value: name.name,
              label: sentenceCase(name.name as string),
            }))}
            rules={[
              {
                required: true,
                message: 'Please select the role for a user',
              },
            ]}
          />
        )}
      </AsyncResourceRenderer>
      {isInviteDisabled && (
        <P variant="sml">
          You have reached maximum no. of Seats ({maxSeats}). Please contact support at{' '}
          <a href={`mailto:${branding.supportEmail}`}>{branding.supportEmail}</a> if you want
          additional seats
        </P>
      )}
    </DrawerForm>
  );
}
