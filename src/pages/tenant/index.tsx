import React, { useRef } from 'react';
import { PageContainer } from '@ant-design/pro-layout';
import { green, red } from '@ant-design/colors';
import ProTable, { ActionType, ProColumns } from '@ant-design/pro-table';
import { Button, message, Popconfirm } from 'antd';
import { useAuth0 } from '@auth0/auth0-react';
import { CheckCircleTwoTone, MinusCircleTwoTone } from '@ant-design/icons';
import InviteForm from './components/InviteForm';
import { useApi } from '@/api';
import { Account } from '@/apis';
import { getUserRole, UserRole } from '@/utils/user-utils';

export default function () {
  const api = useApi();
  const { user } = useAuth0();
  const actionRef = useRef<ActionType>();
  const role = getUserRole(user);

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

  if (role === UserRole.ROOT) {
    columns.push({
      title: 'Actions',
      width: 10,
      sorter: false,
      fixed: 'right',
      render: (_, item) => {
        if (user?.sub === item.user_id) {
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
            <Button danger>Delete</Button>
          </Popconfirm>
        );
      },
    });
  }

  // todo: i18n
  return (
    <PageContainer>
      <ProTable<Account>
        actionRef={actionRef}
        form={{
          labelWrap: true,
        }}
        search={false}
        headerTitle="Team members"
        rowKey="user_id"
        toolBarRender={() => {
          return role === UserRole.ROOT ? [<InviteForm onClose={refreshTable} />] : [];
        }}
        request={async () => {
          const accounts: Array<Account> = await api.getAccounts();
          return {
            data: accounts,
            success: true,
            total: accounts.length,
          };
        }}
        columns={columns}
      />
    </PageContainer>
  );
}
