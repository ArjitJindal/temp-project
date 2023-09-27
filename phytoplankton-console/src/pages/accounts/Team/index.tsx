import React, { useMemo, useRef, useState } from 'react';
import { some } from 'lodash';
import {
  CheckCircleTwoTone,
  DeleteOutlined,
  EditOutlined,
  MinusCircleTwoTone,
  PlusOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';
import s from './index.module.less';
import {
  isAtLeastAdmin,
  parseUserRole,
  useAuth0User,
  useInvalidateUsers,
  UserRole,
  useUsers,
} from '@/utils/user-utils';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { ACCOUNT_LIST } from '@/utils/queries/keys';
import { TableColumn, TableRefType } from '@/components/library/Table/types';
import { Account } from '@/apis';
import COLORS, {
  COLORS_V2_HIGHLIGHT_FLAGRIGHTBLUE,
  COLORS_V2_HIGHLIGHT_HIGHLIGHT_STROKE,
} from '@/components/ui/colors';
import AccountForm from '@/pages/accounts/components/AccountForm';
import Button from '@/components/library/Button';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { message } from '@/components/library/Message';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import RoleTag, { getRoleTitle } from '@/components/ui/RoleTag';
import Confirm from '@/components/utils/Confirm';

export default function Team() {
  const actionRef = useRef<TableRefType>(null);
  const user = useAuth0User();
  const api = useApi();

  function refreshTable() {
    if (actionRef.current) {
      actionRef.current?.reload();
    }
  }
  const accountsResult = usePaginatedQuery(ACCOUNT_LIST(), async (paginationParams) => {
    const accounts = await api.getAccounts({ ...paginationParams });
    const filteredAccounts = accounts.filter(
      (account) => parseUserRole(account.role) !== UserRole.ROOT && !account.blocked,
    );
    return {
      items: filteredAccounts,
      success: true,
      total: filteredAccounts.length,
    };
  });

  const [isInviteVisible, setIsInviteVisible] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);

  const [users, loadingUsers] = useUsers();

  const tagStyle = useMemo(
    () => ({
      background: COLORS_V2_HIGHLIGHT_FLAGRIGHTBLUE,
      borderColor: COLORS_V2_HIGHLIGHT_HIGHLIGHT_STROKE,
      color: 'black',
    }),
    [],
  );

  const invalidateUsers = useInvalidateUsers();

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
        render: (role, context) => {
          return (
            <div>
              {role != null && <RoleTag role={role} />}
              {context.item.isEscalationContact && <Tag style={tagStyle}>Escalation reviewer</Tag>}
              {context.item.reviewerId && <Tag style={tagStyle}>Requires review</Tag>}
              {!loadingUsers && some(users, (u) => u.reviewerId === context.item.id) && (
                <Tag style={tagStyle}>Reviewer</Tag>
              )}
            </div>
          );
        },
        stringify: (role, item) => {
          return [role && getRoleTitle(role), item.isEscalationContact && 'Escalation reviewer']
            .filter((x) => !!x)
            .join(', ');
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
          if (item.role == 'root') {
            return null;
          }

          // todo: i18n
          return (
            <div className={s.buttons}>
              <Confirm
                text="Are you sure that you want to delete this user?"
                title="Are you sure?"
                onConfirm={async () => {
                  try {
                    await api.accountsDelete({ accountId: item.id });
                    message.success('User deleted!');
                    invalidateUsers.invalidate();
                    refreshTable();
                  } catch (e) {
                    const error = e instanceof Response ? (await e.json())?.message : e;
                    message.fatal(`Failed to delete user - ${error}`, e);
                  }
                }}
              >
                {({ onClick }) => (
                  <DeleteOutlined
                    onClick={() => {
                      onClick();
                    }}
                  />
                )}
              </Confirm>
              <div>
                <div
                  style={{ cursor: 'pointer' }}
                  onClick={() => {
                    setEditAccount(item);
                    setIsInviteVisible(true);
                  }}
                >
                  <EditOutlined />
                </div>
              </div>
            </div>
          );
        },
      }),
    );
  }

  return (
    <PageWrapperContentContainer>
      <QueryResultsTable<Account>
        rowKey="id"
        tableId="accounts-list"
        innerRef={actionRef}
        extraTools={
          isAtLeastAdmin(user)
            ? [
                () => (
                  <Button
                    type="TETRIARY"
                    onClick={() => {
                      setEditAccount(null);
                      setIsInviteVisible(true);
                    }}
                  >
                    <PlusOutlined />
                    {'Invite'}
                  </Button>
                ),
              ]
            : []
        }
        queryResults={accountsResult}
        columns={columns}
        pagination={false}
        fitHeight
      />
      <AccountForm
        editAccount={editAccount}
        isVisibile={isInviteVisible}
        onChangeVisibility={setIsInviteVisible}
        onSuccess={refreshTable}
        key={editAccount?.id ?? 'new'}
      />
    </PageWrapperContentContainer>
  );
}
