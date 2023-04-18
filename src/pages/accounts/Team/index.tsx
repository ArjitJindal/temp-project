import React, { useRef } from 'react';
import { CheckCircleTwoTone, DeleteOutlined, MinusCircleTwoTone } from '@ant-design/icons';
import { Popconfirm } from 'antd';
import s from './index.module.less';
import { useApiTime, useButtonTracker } from '@/utils/tracker';
import { isAtLeastAdmin, parseUserRole, useAuth0User, UserRole } from '@/utils/user-utils';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { ACCOUNT_LIST } from '@/utils/queries/keys';
import { TableColumn, TableRefType } from '@/components/library/Table/types';
import { Account } from '@/apis';
import COLORS from '@/components/ui/colors';
import AccountForm from '@/pages/accounts/components/AccountForm';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { capitalizeWords } from '@/utils/tags';
import { message } from '@/components/library/Message';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { PageWrapperTableContainer } from '@/components/PageWrapper';

export default function Team() {
  const actionRef = useRef<TableRefType>(null);
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

  const columnHelper = new ColumnHelper<Account>();
  const columns: TableColumn<Account>[] = columnHelper.list([
    columnHelper.simple<'email'>({
      key: 'email',
      title: 'Email',
      sorting: true,
    }),
    columnHelper.simple<'role'>({
      key: 'role',
      title: 'Role',
      type: {
        render: (role) => {
          return <>{role ? capitalizeWords(role) : ''}</>;
        },
      },
    }),
    columnHelper.simple<'emailVerified'>({
      key: 'emailVerified',
      title: 'Email verification',
      sorting: true,
      type: {
        render: (emailVerified) => {
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
    }),
  ]);

  if (isAtLeastAdmin(user)) {
    columns.push(
      columnHelper.display({
        title: 'Actions',
        render: (item) => {
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
                    message.fatal(`Failed to delete user - ${error}`, e);
                  }
                }}
              >
                <DeleteOutlined onClick={() => handleClick('Delete account')} />
              </Popconfirm>
              <AccountForm editAccount={item} onSuccess={refreshTable} />
            </div>
          );
        },
      }),
    );
  }

  return (
    <PageWrapperTableContainer>
      <QueryResultsTable<Account>
        rowKey="id"
        tableId="accounts-list"
        innerRef={actionRef}
        extraTools={
          isAtLeastAdmin(user)
            ? [() => <AccountForm editAccount={null} onSuccess={refreshTable} />]
            : []
        }
        queryResults={accountsResult}
        columns={columns}
        pagination={false}
        fitHeight
      />
    </PageWrapperTableContainer>
  );
}
