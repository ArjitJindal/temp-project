import React, { useMemo, useRef, useState } from 'react';
import { some } from 'lodash';
import { EditOutlined, PlusOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import s from './index.module.less';
import {
  isAtLeastAdmin,
  parseUserRole,
  useAccountsQueryResult,
  useAuth0User,
  useInvalidateUsers,
  UserRole,
  useUsers,
} from '@/utils/user-utils';
import { useApi } from '@/api';
import { TableColumn, TableRefType } from '@/components/library/Table/types';
import { Account, AccountDeletePayload } from '@/apis';
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
import Modal from '@/components/library/Modal';
import Select from '@/components/library/Select';
import { P } from '@/components/ui/Typography';
import { CloseMessage, message } from '@/components/library/Message';
import CheckCircleOutlined from '@/components/ui/icons/Remix/system/checkbox-circle-line.react.svg';
import MinusCircleOutlined from '@/components/ui/icons/Remix/system/indeterminate-circle-line.react.svg';
import DeleteOutlined from '@/components/ui/icons/Remix/system/delete-bin-2-line.react.svg';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import Confirm from '@/components/utils/Confirm';
import Tag from '@/components/library/Tag';
import { QueryResult } from '@/utils/queries/types';
import { getOr, isSuccess, loading, success } from '@/utils/asyncResource';
import { PaginatedData } from '@/utils/queries/hooks';

export default function Team() {
  const actionRef = useRef<TableRefType>(null);
  const user = useAuth0User();
  const api = useApi();
  const [deletedUserId, setDeletedUserId] = useState<string | null>(null);
  function refreshTable() {
    if (actionRef.current) {
      actionRef.current?.reload();
    }
  }
  const invalidateUsers = useInvalidateUsers().invalidate;
  let messageVar: CloseMessage | null = null;
  const allAccountsResult = useAccountsQueryResult();
  const accountsResult: QueryResult<PaginatedData<Account>> = useMemo(() => {
    if (isSuccess(allAccountsResult.data)) {
      const filteredAccounts = allAccountsResult.data.value.filter((account) => {
        const role = parseUserRole(account.role);
        return role !== UserRole.ROOT && role !== UserRole.WHITELABEL_ROOT && !account.blocked;
      });
      return {
        ...allAccountsResult,
        paginate: undefined,
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
  const deactiveUserMutation = useMutation<
    unknown,
    unknown,
    AccountDeletePayload & { userId: string }
  >(
    async (payload: AccountDeletePayload & { userId: string }) => {
      messageVar = message.loading(`Please wait while we are deleting the user`);
      return await api.accountsDelete({
        AccountDeletePayload: {
          reassignTo: payload.reassignTo,
        },
        accountId: payload.userId,
      });
    },
    {
      onSuccess: () => {
        messageVar?.();
        message.success(`User deleted successfully`);
        setDeletedUserId(null);
        setReassignTo(null);
        invalidateUsers();
        refreshTable();
      },
      onError: (error) => {
        messageVar?.();
        message.error(`Error while deleting the user: ${(error as Error)?.message}`);
      },
    },
  );

  const [isInviteVisible, setIsInviteVisible] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [reassignTo, setReassignTo] = useState<string | null>(null);
  const [users, loadingUsers] = useUsers({});
  const columnHelper = new ColumnHelper<Account>();
  const columns: TableColumn<Account>[] = columnHelper.list([
    columnHelper.simple<'email'>({
      key: 'email',
      title: 'Email',
      sorting: true,
      defaultWidth: 350,
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
              {context.item.isEscalationContact && <Tag className={s.tag}>Escalation reviewer</Tag>}
              {context.item.reviewerId && <Tag className={s.tag}>Maker</Tag>}
              {!loadingUsers && some(users, (u) => u.reviewerId === context.item.id) && (
                <Tag className={s.tag}>Checker</Tag>
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
      },
    }),
  ]);

  if (isAtLeastAdmin(user)) {
    columns.push(
      columnHelper.display({
        title: 'Actions',
        enableResizing: false,
        defaultWidth: 350,
        render: (item) => {
          // Do not let people edit themselves or roots.
          if (item.role == 'root' || item.role !== 'admin') {
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
              >
                Edit
              </Button>
              {accounts.length === 1 && user.role === UserRole.ROOT ? (
                <Confirm
                  text="This is the only user in the tenant."
                  title="Are you sure you want to delete this user?"
                  onConfirm={() => {
                    deactiveUserMutation.mutate({
                      userId: item.id,
                      reassignTo: user.userId, // reassign to self if superuser is the only user
                    });
                  }}
                >
                  {({ onClick }) => (
                    <Button
                      testName="accounts-delete-button"
                      type="TETRIARY"
                      onClick={onClick}
                      isDisabled={item.blocked || item.id === user.userId}
                      icon={<DeleteOutlined />}
                    >
                      Delete
                    </Button>
                  )}
                </Confirm>
              ) : (
                <Button
                  testName="accounts-delete-button"
                  type="TETRIARY"
                  onClick={() => {
                    if (accounts.length === 1 && user.role === UserRole.ROOT) {
                      deactiveUserMutation.mutate({
                        userId: item.id,
                        reassignTo: user.userId, // reassign to self if superuser is the only user
                      });
                    } else {
                      setDeletedUserId(item.id);
                    }
                  }}
                  isDisabled={item.blocked || item.id === user.userId}
                  icon={<DeleteOutlined />}
                >
                  Delete
                </Button>
              )}
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
          isAtLeastAdmin(user)
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
      <Modal
        isOpen={!!deletedUserId}
        onCancel={() => {
          setDeletedUserId(null);
          setReassignTo(null);
        }}
        title="Are you sure you want to delete this user?"
        hideFooter
      >
        <div className={s.deletedModalContent}>
          <P grey variant="m" style={{ marginBottom: 0 }}>
            Deleted users will not be able to login to console and perform any relevant actions.
            Please make sure to re-assign the open cases/alerts of the deleted user to an account.
          </P>
          <Select
            options={accounts.map((account) => ({
              label: account.email,
              value: account.id,
            }))}
            placeholder="Select an account Email ID"
            style={{ width: 300 }}
            mode="SINGLE"
            onChange={(value) => setReassignTo(value ?? null)}
            value={reassignTo}
          />
          <Button
            testName="delete-account"
            type="PRIMARY"
            isDisabled={!reassignTo}
            onClick={() => {
              if (deletedUserId && reassignTo) {
                deactiveUserMutation.mutate({
                  userId: deletedUserId,
                  reassignTo,
                });
              }
            }}
          >
            Delete
          </Button>
        </div>
      </Modal>
    </PageWrapperContentContainer>
  );
}
