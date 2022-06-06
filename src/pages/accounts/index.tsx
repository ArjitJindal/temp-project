import React, { useRef } from 'react';
import { green, red } from '@ant-design/colors';
import ProTable, { ActionType, ProColumns } from '@ant-design/pro-table';
import { message, Popconfirm } from 'antd';
import { CheckCircleTwoTone, MinusCircleTwoTone } from '@ant-design/icons';
import AccountInviteForm from './components/AccountInviteForm';
import { useApi } from '@/api';
import { Account } from '@/apis';
import { isAtLeastAdmin, useAuth0User } from '@/utils/user-utils';
import PageWrapper from '@/components/PageWrapper';
import { measure } from '@/utils/time-utils';
import { useAnalytics } from '@/utils/segment/context';
import Button from '@/components/ui/Button';

export default function () {
  const api = useApi();
  const user = useAuth0User();
  const actionRef = useRef<ActionType>();

  function refreshTable() {
    if (actionRef.current) {
      actionRef.current?.reload();
    }
  }

  // todo: i18n
  const columns: ProColumns<Account>[] = [
    {
      title: 'ID',
      width: 10,
      dataIndex: 'user_id',
      sorter: true,
    },
    {
      title: 'Email',
      width: 300,
      dataIndex: 'email',
      sorter: true,
    },
    {
      title: 'Verified',
      width: 10,
      dataIndex: 'email_verified',
      sorter: true,
      render: (_, { email_verified }) => {
        return (
          <span>
            {email_verified ? (
              <CheckCircleTwoTone twoToneColor={green.primary} />
            ) : (
              <MinusCircleTwoTone twoToneColor={red.primary} />
            )}
          </span>
        );
      },
    },
  ];

  if (isAtLeastAdmin(user)) {
    columns.push({
      title: 'Actions',
      width: 10,
      sorter: false,
      fixed: 'right',
      render: (_, item) => {
        if (user?.userId === item.user_id) {
          return null;
        }

        // todo: i18n
        return (
          <Popconfirm
            title="Are you sure that you want to delete this user?"
            onConfirm={async () => {
              try {
                await api.accountsDelete({ userId: item.user_id });
                message.success('User deleted!');
                refreshTable();
              } catch (e) {
                const error = e instanceof Response ? (await e.json())?.message : e;
                message.error(`Failed to delete user - ${error}`, 10);
              }
            }}
          >
            <Button analyticsName="Delete account" danger>
              Delete
            </Button>
          </Popconfirm>
        );
      },
    });
  }

  const analytics = useAnalytics();

  // todo: i18n
  return (
    <PageWrapper>
      <ProTable<Account>
        actionRef={actionRef}
        form={{
          labelWrap: true,
        }}
        search={false}
        headerTitle="Tenant accounts"
        rowKey="user_id"
        toolBarRender={() => {
          return isAtLeastAdmin(user) ? [<AccountInviteForm onClose={refreshTable} />] : [];
        }}
        request={async () => {
          const [accounts, time] = await measure(() => api.getAccounts());
          analytics.event({
            title: 'Table Loaded',
            time,
          });
          return {
            data: accounts,
            success: true,
            total: accounts.length,
          };
        }}
        columns={columns}
        columnsState={{
          persistenceType: 'localStorage',
          persistenceKey: 'accounts-list',
        }}
      />
    </PageWrapper>
  );
}
