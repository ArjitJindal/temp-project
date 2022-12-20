import React, { useRef } from 'react';
import { message, Popconfirm } from 'antd';
import { CheckCircleTwoTone, MinusCircleTwoTone } from '@ant-design/icons';
import AccountForm from './components/AccountForm';
import s from './index.module.less';
import { useApi } from '@/api';
import { Account } from '@/apis';
import { isAtLeastAdmin, parseUserRole, useAuth0User, UserRole } from '@/utils/user-utils';
import PageWrapper from '@/components/PageWrapper';
import Button from '@/components/ui/Button';
import { TableActionType } from '@/components/ui/Table';
import { useI18n } from '@/locales';
import COLORS from '@/components/ui/colors';
import { TableColumn } from '@/components/ui/Table/types';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { ACCOUNT_LIST } from '@/utils/queries/keys';
import RoleTag from '@/components/ui/RoleTag';

export default function () {
  const api = useApi();
  const user = useAuth0User();
  const actionRef = useRef<TableActionType>(null);

  function refreshTable() {
    if (actionRef.current) {
      actionRef.current?.reload();
    }
  }

  // todo: i18n
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
        if (user.userId === item.id) {
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
              <Button analyticsName="Delete account" danger>
                Delete
              </Button>
            </Popconfirm>
            <AccountForm editAccount={item} onSuccess={refreshTable} />
          </div>
        );
      },
    });
  }

  const accountsResult = usePaginatedQuery(ACCOUNT_LIST(), async () => {
    const accounts = await api.getAccounts();
    const filteredAccounts = accounts.filter(
      (account) => parseUserRole(account.role) !== UserRole.ROOT,
    );
    return {
      items: filteredAccounts,
      success: true,
      total: filteredAccounts.length,
    };
  });

  const i18n = useI18n();
  // todo: i18n
  return (
    <PageWrapper title={i18n('menu.accounts')}>
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
      />
    </PageWrapper>
  );
}
