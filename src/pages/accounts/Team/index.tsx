import React, { useRef } from 'react';
import { CheckCircleTwoTone, MinusCircleTwoTone, DeleteOutlined } from '@ant-design/icons';
import { message, Popconfirm } from 'antd';
import s from './index.module.less';
import { useApiTime, useButtonTracker } from '@/utils/tracker';
import { TableActionType } from '@/components/ui/Table';
import { isAtLeastAdmin, parseUserRole, useAuth0User, UserRole } from '@/utils/user-utils';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { ACCOUNT_LIST } from '@/utils/queries/keys';
import { TableColumn } from '@/components/ui/Table/types';
import { Account } from '@/apis';
import COLORS from '@/components/ui/colors';
import AccountForm from '@/pages/accounts/components/AccountForm';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { capitalizeWords } from '@/utils/tags';

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
      (account) => parseUserRole(account.role) !== UserRole.ROOT && !account.blocked,
    );
    return {
      items: filteredAccounts,
      success: true,
      total: filteredAccounts.length,
    };
  });

  const buttonTracker = useButtonTracker();

  const handleClick = (analyticsName: string) => {
    if (analyticsName) {
      buttonTracker(analyticsName);
    }
  };

  const columns: TableColumn<Account>[] = [
    {
      title: 'Email',
      width: 200,
      dataIndex: 'email',
      exportData: 'email',
      sorter: true,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      exportData: 'role',
      width: 100,
      render: (_, { role }) => {
        return capitalizeWords(role);
      },
    },
    {
      title: 'Email verification',
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
              <DeleteOutlined onClick={() => handleClick('Delete account')} />
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
