import React, { useMemo, useRef, useState } from 'react';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import { DeleteUser } from '../components/DeleteUser';
import s from './index.module.less';
import {
  parseUserRole,
  useAccountsQueryResult,
  useAuth0User,
  useHasPermissions,
  useInvalidateUsers,
  UserRole,
} from '@/utils/user-utils';
import { useApi } from '@/api';
import { TableColumn, TableRefType } from '@/components/library/Table/types';
import { Account } from '@/apis';
import {
  COLORS_V2_ALERT_CRITICAL,
  COLORS_V2_ALERT_SUCCESS,
  COLORS_V2_STATE_DISABLED,
} from '@/components/ui/colors';
import AccountForm from '@/pages/accounts/components/AccountForm';
import Button from '@/components/library/Button';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import RoleTag, { getRoleTitle } from '@/components/library/Tag/RoleTag';
import { P } from '@/components/ui/Typography';
import { CloseMessage, message } from '@/components/library/Message';
import CheckCircleOutlined from '@/components/ui/icons/Remix/system/checkbox-circle-line.react.svg';
import MinusCircleOutlined from '@/components/ui/icons/Remix/system/indeterminate-circle-line.react.svg';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import Tag from '@/components/library/Tag';
import { QueryResult } from '@/utils/queries/types';
import { getOr, isSuccess, loading, success } from '@/utils/asyncResource';
import { PaginatedData } from '@/utils/queries/hooks';
import Toggle from '@/components/library/Toggle';
import { ACCOUNT_LIST } from '@/utils/queries/keys';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export default function Team() {
  const actionRef = useRef<TableRefType>(null);
  const user = useAuth0User();
  const api = useApi();
  const [deletedUserId, setDeletedUserId] = useState<string | null>(null);
  const isMultiLevelEscalationEnabled = useFeatureEnabled('MULTI_LEVEL_ESCALATION');
  const invalidateUsers = useInvalidateUsers().invalidate;
  let messageVar: CloseMessage | null = null;
  const allAccountsResult = useAccountsQueryResult();
  const queryClient = useQueryClient();
  const accountsResult: QueryResult<PaginatedData<Account>> = useMemo(() => {
    if (isSuccess(allAccountsResult.data)) {
      const filteredAccounts = allAccountsResult.data.value
        .filter((account) => {
          const role = parseUserRole(account.role);
          return (
            role !== UserRole.ROOT &&
            role !== UserRole.WHITELABEL_ROOT &&
            (!account.blocked || account.blockedReason !== 'DELETED')
          );
        })
        .sort((a, b) => {
          return a.blocked.toString().localeCompare(b.blocked.toString());
        });
      return {
        ...allAccountsResult,
        paginate: async () => {
          return {
            items: filteredAccounts,
            total: filteredAccounts.length,
          };
        },
        data: success({
          items: filteredAccounts,
          success: true,
          total: filteredAccounts.length,
        }),
      };
    }
    return {
      ...allAccountsResult,
      paginate: undefined,
      data: loading(),
    };
  }, [allAccountsResult]);

  const deactivateUserMutation = useMutation<
    Account,
    Error,
    { accountId: string; deactivate: boolean }
  >(
    async (payload: { accountId: string; deactivate: boolean }) => {
      messageVar = message.loading(
        `Please wait while we are ${payload.deactivate ? 'deactivating' : 'reactivating'} the user`,
      );
      return await api.accountsDeactivate({
        accountId: payload.accountId,
        InlineObject1: {
          deactivate: payload.deactivate,
        },
      });
    },
    {
      onSuccess: (data: Account, { deactivate }) => {
        queryClient.setQueryData<Account[]>(ACCOUNT_LIST(), (oldData: Account[] | undefined) => {
          if (oldData) {
            return oldData.map((account: Account) => {
              if (account.id === data.id) {
                return {
                  ...account,
                  blocked: data.blocked,
                  blockedReason: data.blockedReason,
                };
              }
              return account;
            });
          }
          return oldData;
        });
        messageVar?.();
        message.success(`User ${deactivate ? 'deactivated' : 'reactivated'} successfully`);
      },
      onError: (error: Error, { deactivate }) => {
        messageVar?.();
        message.error(
          `Failed to ${deactivate ? 'deactivate' : 'reactivate'} user: ${error.message}`,
        );
      },
    },
  );

  const [isInviteVisible, setIsInviteVisible] = useState(false);
  const isAccountPermissionsEnabled = useHasPermissions(['accounts:overview:write']);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const columnHelper = new ColumnHelper<Account>();
  const columns: TableColumn<Account>[] = columnHelper.list([
    columnHelper.simple<'email'>({
      key: 'email',
      title: 'Email',
      sorting: true,
      defaultWidth: 350,
      type: {
        render(email, context) {
          return (
            <div className={s.email}>
              <P variant="m" fontWeight="normal" style={{ marginBottom: 0 }}>
                {email}
              </P>
              {context.item.blocked && (
                <Tag color="red">{humanizeConstant(context.item.blockedReason ?? '')}</Tag>
              )}
            </div>
          );
        },
        stringify(value, item) {
          return `${value}${item.blocked ? ' (Blocked)' : ''}`;
        },
      },
    }),
    columnHelper.simple<'role'>({
      key: 'role',
      title: 'Role',
      defaultWidth: 200,
      type: {
        render: (role, context) => {
          return (
            <div className={s.roleTags}>
              {role != null && <RoleTag role={role} />}
              {context.item.escalationLevel && (
                <Tag className={s.tag}>
                  Escalation{' '}
                  {isMultiLevelEscalationEnabled ? context.item.escalationLevel : 'reviewer'}
                </Tag>
              )}
              {context.item.reviewerId && <Tag className={s.tag}>Maker</Tag>}
              {context.item.isReviewer && <Tag className={s.tag}>Checker</Tag>}
            </div>
          );
        },
        stringify: (role, item) => {
          return [
            role && getRoleTitle(role),
            item.escalationLevel && isMultiLevelEscalationEnabled
              ? `Escalation ${item.escalationLevel}`
              : 'Escalation reviewer',
          ]
            .filter((x) => !!x)
            .join(', ');
        },
      },
    }),
    columnHelper.simple<'lastLogin'>({
      key: 'lastLogin',
      title: 'Last login',
      type: {
        stringify: (lastLogin) => {
          if (!lastLogin) {
            return 'N/A';
          }
          return new Date(lastLogin).toLocaleString();
        },
      },
      hideInTable: true,
      exporting: true,
    }),
    columnHelper.simple<'createdAt'>({
      key: 'createdAt',
      title: 'Created at',
      type: {
        stringify: (createdAt) => {
          if (!createdAt) {
            return 'N/A';
          }
          return new Date(createdAt).toLocaleString();
        },
      },
      hideInTable: true,
      exporting: true,
    }),
    columnHelper.simple<'lastPasswordReset'>({
      key: 'lastPasswordReset',
      title: 'Last password reset',
      type: {
        stringify: (lastPasswordReset) => {
          if (!lastPasswordReset) {
            return 'N/A';
          }
          return new Date(lastPasswordReset).toLocaleString();
        },
      },
      hideInTable: true,
      exporting: true,
    }),
    columnHelper.simple<'emailVerified'>({
      key: 'emailVerified',
      title: 'Email verification',
      sorting: true,
      defaultWidth: 250,
      type: {
        render: (emailVerified, context) => {
          return (
            <div className={s.emailVerified}>
              {emailVerified ? (
                <>
                  <CheckCircleOutlined
                    color={
                      context.item.blocked ? COLORS_V2_STATE_DISABLED : COLORS_V2_ALERT_SUCCESS
                    }
                    height={16}
                    width={16}
                  />{' '}
                  <P
                    variant="m"
                    fontWeight="normal"
                    grey={context.item.blocked}
                    style={{ marginBottom: 0 }}
                  >
                    Verified
                  </P>
                </>
              ) : (
                <>
                  <MinusCircleOutlined
                    color={
                      context.item.blocked ? COLORS_V2_STATE_DISABLED : COLORS_V2_ALERT_CRITICAL
                    }
                    height={16}
                    width={16}
                  />{' '}
                  <P
                    variant="m"
                    fontWeight="normal"
                    grey={context.item.blocked}
                    style={{ marginBottom: 0 }}
                  >
                    Not verified
                  </P>
                </>
              )}
            </div>
          );
        },
        stringify: (emailVerified) => (emailVerified ? 'Verified' : 'Not verified'),
      },
    }),
    columnHelper.simple<'blocked'>({
      key: 'blocked',
      title: 'User status',
      type: {
        stringify: (blocked) => (blocked ? 'INACTIVE' : 'ACTIVE'),
      },
      hideInTable: true,
      exporting: true,
    }),
  ]);

  if (isAccountPermissionsEnabled) {
    columns.push(
      columnHelper.display({
        title: 'Status',
        render: (item) => {
          return (
            <Toggle
              value={!item.blocked}
              onChange={(checked) => {
                deactivateUserMutation.mutate({
                  accountId: item.id,
                  deactivate: !checked,
                });
              }}
              disabled={item.id === user.userId}
            />
          );
        },
      }),
      columnHelper.display({
        title: 'Actions',
        enableResizing: false,
        defaultWidth: 350,
        render: (item) => {
          // Do not let people edit themselves or roots.
          if (item.role == 'root') {
            return null;
          }

          return (
            <div className={s.buttons}>
              <Button
                testName="accounts-edit-button"
                type="SECONDARY"
                onClick={() => {
                  setEditAccount(item);
                  setIsInviteVisible(true);
                }}
                icon={<EditOutlined />}
                isDisabled={item.blocked}
                requiredPermissions={['accounts:overview:write']}
              >
                Edit
              </Button>
              <DeleteUser
                item={item}
                user={user}
                accounts={accounts}
                onSuccess={() => {
                  invalidateUsers();
                  accountsResult.refetch();
                }}
                setDeletedUserId={setDeletedUserId}
                isDisabled={(item) => item.blocked || item.id === user.userId}
              />
            </div>
          );
        },
      }),
    );
  }

  const accounts = getOr(accountsResult.data, { items: [] }).items.filter(
    (account) => account !== null && account.id !== deletedUserId,
  );

  return (
    <PageWrapperContentContainer>
      <QueryResultsTable<Account>
        rowKey="id"
        tableId="accounts-list"
        innerRef={actionRef}
        extraTools={
          isAccountPermissionsEnabled
            ? [
                () => (
                  <Button
                    type="TETRIARY"
                    onClick={() => {
                      setEditAccount(null);
                      setIsInviteVisible(true);
                    }}
                    icon={<PlusOutlined />}
                  >
                    Invite
                  </Button>
                ),
              ]
            : []
        }
        queryResults={accountsResult}
        params={{
          pageSize: 100,
          sort: [],
          pagination: false,
        }}
        columns={columns}
        pagination={false}
        fitHeight
      />

      <AccountForm
        editAccount={editAccount}
        isVisibile={isInviteVisible}
        onChangeVisibility={setIsInviteVisible}
        onSuccess={() => {
          setIsInviteVisible(false);
          accountsResult.refetch();
        }}
        key={editAccount?.id ?? 'new'}
        accounts={accounts}
      />
    </PageWrapperContentContainer>
  );
}
