import React, { useRef } from 'react';
import { CheckCircleTwoTone, MinusCircleTwoTone } from '@ant-design/icons';
import { message, Popconfirm } from 'antd';
import s from './index.module.less';
import { useApiTime } from '@/utils/tracker';
import { TableActionType } from '@/components/ui/Table';
import { isAtLeastAdmin, parseUserRole, useAuth0User, UserRole } from '@/utils/user-utils';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { ACCOUNT_LIST } from '@/utils/queries/keys';
import { TableColumn } from '@/components/ui/Table/types';
import { Account } from '@/apis';
import RoleTag from '@/components/ui/RoleTag';
import COLORS from '@/components/ui/colors';
import Button from '@/components/library/Button';
import AccountForm from '@/pages/accounts/components/AccountForm';
import QueryResultsTable from '@/components/common/QueryResultsTable';

export default function Team() {
  const actionRef = useRef<TableActionType>(null);
  const user = useAuth0User();
  const measure = useApiTime();
  const api = useApi();

  function refreshTable() {
    if (actionRef.current) {
      actionRef.current?.reload();
    }
  }
  const accountsResult = usePaginatedQuery(ACCOUNT_LIST(), async () => {
    const accounts = await measure(() => api.getAccounts(), 'Get accounts');
    const filteredAccounts = accounts.filter(
      (account) => parseUserRole(account.role) !== UserRole.ROOT,
    );
    return {
      items: filteredAccounts,
      success: true,
      total: filteredAccounts.length,
    };
  });

  const columns: TableColumn<Account>[] = [
    {
      title: 'ID',
      width: 10,
      dataIndex: 'id',
      exportData: 'id',
      sorter: true,
    },
    {
      title: 'Email',
      width: 300,
      dataIndex: 'email',
      exportData: 'email',
      sorter: true,
    },
    {
      title: 'Role',
      exportData: 'role',
      width: 100,
      render: (_, item) => <RoleTag role={item.role} />,
    },
    {
      title: 'Verified',
      width: 10,
      dataIndex: 'emailVerified',
      exportData: 'emailVerified',
      sorter: true,
      render: (_, { emailVerified }) => {
        return (
          <span>
            {emailVerified ? (
              <CheckCircleTwoTone twoToneColor={COLORS.successColor.base} />
            ) : (
              <MinusCircleTwoTone twoToneColor={COLORS.errorColor.base} />
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
      exportData: false,
      render: (_, item) => {
        // Do not let people edit themselves or roots.
        if (user.userId === item.id || item.role == 'root') {
          return null;
        }

        // todo: i18n
        return (
          <div className={s.buttons}>
            <Popconfirm
              title="Are you sure that you want to delete this user?"
              onConfirm={async () => {
                try {
                  await api.accountsDelete({ accountId: item.id });
                  message.success('User deleted!');
                  refreshTable();
                } catch (e) {
                  const error = e instanceof Response ? (await e.json())?.message : e;
                  message.error(`Failed to delete user - ${error}`, 10);
                }
              }}
            >
              <Button analyticsName="Delete account" type="TETRIARY">
                Delete
              </Button>
            </Popconfirm>
            <AccountForm editAccount={item} onSuccess={refreshTable} />
          </div>
        );
      },
    });
  }

  return (
    <QueryResultsTable<Account>
      actionRef={actionRef}
      form={{
        labelWrap: true,
      }}
      search={false}
      headerTitle="Team accounts"
      rowKey="id"
      toolBarRender={() => {
        return isAtLeastAdmin(user)
          ? [<AccountForm editAccount={null} onSuccess={refreshTable} />]
          : [];
      }}
      queryResults={accountsResult}
      columns={columns}
      columnsState={{
        persistenceType: 'localStorage',
        persistenceKey: 'accounts-list',
      }}
      pagination={false}
    />
  );
}
