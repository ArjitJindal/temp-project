import React, { useCallback, useRef, useState } from 'react';
import { Input, message } from 'antd';
import s from './index.module.less';
import { RequestTable } from '@/components/RequestTable';
import { TableActionType } from '@/components/ui/Table';
import { ListHeader } from '@/apis';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import { getErrorMessage } from '@/utils/lang';
import UserSearchPopup from '@/pages/transactions/components/UserSearchPopup';
import { User } from '@/pages/transactions/components/UserSearchPopup/types';
import { getUserName } from '@/utils/api/users';

interface UserData {
  userId: string | null;
  userFullName: string;
  reason: string;
}

interface ExistedTableItem extends UserData {
  type: 'EXISTED';
}

interface NewTableItem extends UserData {
  type: 'NEW';
}

type TableItem = ExistedTableItem | NewTableItem;

export type UserListTableRef = React.Ref<{
  reload: () => void;
}>;

interface Props {
  listHeader: ListHeader;
}

function UserListTable(props: Props) {
  const { listHeader } = props;
  const { listId, listType, size } = listHeader;

  const api = useApi();
  const [editUserData, setEditUserData] = useState<UserData | null>(null);
  const [newUserData, setNewUserData] = useState<UserData>({
    userId: null,
    userFullName: '',
    reason: '',
  });

  const tableRef = useRef<TableActionType>(null);

  const isNewUserValid = !!(newUserData.userId && newUserData.reason);
  const [isAddUserLoading, setAddUserLoading] = useState(false);
  const handleChooseUser = useCallback((user: User) => {
    setNewUserData((state) => ({
      ...state,
      userId: user.userId,
      userFullName: getUserName(user),
    }));
  }, []);
  const handleAddUser = useCallback(() => {
    const hideMessage = message.loading('Adding user to a list...', 0);
    if (isNewUserValid) {
      setAddUserLoading(true);
      api
        .postListItem({
          listType,
          listId,
          ListItem: {
            key: newUserData.userId ?? '',
            metadata: {
              reason: newUserData.reason,
              userFullName: newUserData.userFullName,
            },
          },
        })
        .then(() => {
          hideMessage();
          setNewUserData({
            userId: null,
            userFullName: '',
            reason: '',
          });
          message.success(`User successfully added!`);
          tableRef.current?.reload();
        })
        .catch((e) => {
          hideMessage();
          message.error(`Unable to add user to a list! ${getErrorMessage(e)}`);
        })
        .finally(() => {
          setAddUserLoading(false);
        });
    }
  }, [isNewUserValid, newUserData, listId, listType, api]);

  const [isEditUserLoading, setEditUserLoading] = useState(false);
  const isEditUserValid = !!editUserData?.reason;
  const handleSaveUser = () => {
    if (isEditUserValid) {
      setEditUserLoading(true);
      api
        .postListItem({
          listType: listHeader.listType,
          listId,
          ListItem: {
            key: editUserData.userId ?? '',
            metadata: {
              reason: editUserData.reason,
              userFullName: editUserData.userFullName,
            },
          },
        })
        .then(() => {
          setEditUserData(null);
          tableRef.current?.reload();
        })
        .catch((e) => {
          message.error(`Unable to save user! ${getErrorMessage(e)}`);
        })
        .finally(() => {
          setEditUserLoading(false);
        });
    }
  };

  const [isUserDeleteLoading, setEditDeleteLoading] = useState(false);
  const handleDeleteUser = (userId: string) => {
    setEditDeleteLoading(true);
    api
      .deleteListItem({
        listId,
        listType: listHeader.listType,
        key: userId,
      })
      .then(() => {
        tableRef.current?.reload();
      })
      .catch((e) => {
        message.error(`Unable to delete user from list! ${getErrorMessage(e)}`);
      })
      .finally(() => {
        setEditDeleteLoading(false);
      });
  };

  const request = useCallback(
    async (params) => {
      const response = await api.getListItems({
        listType,
        listId,
        page: params.current,
      });
      const data: TableItem[] = [
        ...response.map(
          ({ key, metadata }): TableItem => ({
            type: 'EXISTED',
            userId: key,
            userFullName: metadata?.userFullName ?? '',
            reason: metadata?.reason ?? '',
          }),
        ),
        {
          type: 'NEW',
          userId: '',
          userFullName: '',
          reason: '',
        },
      ];
      return {
        items: data,
        success: true,
        total: size + 1,
      };
    },
    [api, listId, listType, size],
  );

  return (
    <div className={s.root}>
      <RequestTable<TableItem>
        rowKey="userId"
        actionRef={tableRef}
        options={{
          reload: false,
          setting: false,
          density: false,
        }}
        search={false}
        columns={[
          {
            title: 'User ID',
            width: 120,
            search: false,
            render: (_, entity) =>
              entity.type === 'NEW' ? (
                <UserSearchPopup initialSearch={''} onConfirm={handleChooseUser} placement="top">
                  <Button style={{ width: '100%' }}>
                    {newUserData.userFullName || 'Choose user'}
                  </Button>
                </UserSearchPopup>
              ) : (
                entity.userId
              ),
            onCell: (_) => {
              if (_.type === 'NEW') {
                return { colSpan: 2 };
              }
              return {};
            },
          },
          {
            title: 'User name',
            width: 120,
            search: false,
            render: (_, entity) => entity.userFullName,
            onCell: (_) => {
              if (_.type === 'NEW') {
                return { colSpan: 0 };
              }
              return {};
            },
          },
          {
            title: 'Reason for adding to list',
            search: false,
            render: (_, entity) => {
              if (entity.type === 'NEW') {
                return (
                  <Input
                    disabled={isAddUserLoading}
                    value={newUserData.reason}
                    onChange={(e) => {
                      setNewUserData((prevState) => ({
                        ...prevState,
                        reason: e.currentTarget.value,
                      }));
                    }}
                  />
                );
              } else if (entity.userId === editUserData?.userId) {
                return (
                  <Input
                    disabled={isUserDeleteLoading}
                    value={editUserData.reason}
                    onChange={(e) => {
                      setEditUserData({
                        ...editUserData,
                        reason: e.currentTarget.value,
                      });
                    }}
                  />
                );
              }
              return entity.reason;
            },
          },
          {
            title: 'Actions',
            search: false,
            width: 1,
            render: (_, entity) => {
              if (entity.type === 'NEW') {
                return (
                  <div className={s.actions}>
                    <Button
                      type="primary"
                      disabled={isAddUserLoading || !isNewUserValid}
                      onClick={handleAddUser}
                    >
                      Add
                    </Button>
                  </div>
                );
              } else if (entity.type === 'EXISTED') {
                if (editUserData?.userId === entity.userId) {
                  return (
                    <div className={s.actions}>
                      <Button
                        size="small"
                        type="primary"
                        onClick={handleSaveUser}
                        disabled={isEditUserLoading || !isEditUserValid}
                      >
                        Save
                      </Button>
                      <Button
                        size="small"
                        type="ghost"
                        disabled={isEditUserLoading}
                        onClick={() => {
                          setEditUserData(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  );
                }
                return (
                  <div className={s.actions}>
                    <Button
                      size="small"
                      type="ghost"
                      disabled={isUserDeleteLoading}
                      onClick={() => {
                        setEditUserData(entity);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="small"
                      danger={true}
                      type="ghost"
                      disabled={isUserDeleteLoading}
                      onClick={() => {
                        handleDeleteUser(entity.userId ?? '');
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                );
              }
            },
          },
        ]}
        request={request}
      />
    </div>
  );
}

export default UserListTable;
