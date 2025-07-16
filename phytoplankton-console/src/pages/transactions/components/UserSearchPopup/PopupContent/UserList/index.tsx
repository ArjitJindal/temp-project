import React from 'react';
import pluralize from 'pluralize';
import { List } from 'antd';
import cn from 'clsx';
import s from './style.module.less';
import UserItem from './UserItem';
import { AsyncResource } from '@/utils/asyncResource';
import { AllUsersTableItemPreview } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Spinner from '@/components/library/Spinner';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { UserSearchParams } from '@/pages/users/users-list';

interface Props {
  selectedUser: AllUsersTableItemPreview | null;
  onSelectUser: (user: AllUsersTableItemPreview) => void;
  search: string;
  usersRes: AsyncResource<{
    total: number;
    users: AllUsersTableItemPreview[];
  }>;
  handleChangeParams?: (params: UserSearchParams) => void;
  params?: UserSearchParams;
  onClose?: () => void;
}

interface RenderMessageParams {
  users: AllUsersTableItemPreview[];
  total: number;
  search: string;
  userAlias?: string;
  handleChangeParams?: (params: UserSearchParams) => void;
  params?: UserSearchParams;
  onClose?: () => void;
}

export default function UserList(props: Props) {
  const { usersRes, selectedUser, search, onSelectUser, handleChangeParams, params, onClose } =
    props;
  const settings = useSettings();

  // todo: i18n
  return (
    <div className={s.root}>
      <div
        id="scrollableDiv"
        style={{
          maxHeight: 200,
          overflow: 'auto',
        }}
      >
        <AsyncResourceRenderer
          resource={usersRes}
          renderLoading={() => (
            <div className={s.spinner}>
              <Spinner />
            </div>
          )}
        >
          {({ users, total }) => (
            <>
              {renderMessage({
                users,
                total,
                search,
                userAlias: settings.userAlias,
                handleChangeParams,
                params,
                onClose,
              })}
              {users.length > 0 && (
                <List<AllUsersTableItemPreview>
                  dataSource={users}
                  renderItem={(nextUser) => (
                    <UserItem
                      user={nextUser}
                      key={nextUser.userId}
                      isActive={nextUser.userId === selectedUser?.userId}
                      onClick={() => {
                        onSelectUser(nextUser);
                        onClose?.();
                      }}
                    />
                  )}
                />
              )}
            </>
          )}
        </AsyncResourceRenderer>
      </div>
    </div>
  );
}

function renderMessage({
  users,
  total,
  search,
  userAlias,
  handleChangeParams,
  params,
  onClose,
}: RenderMessageParams) {
  const length = users.length;
  if (length === 0) {
    return (
      <div className={s.nothingFound}>
        We could not find a {userAlias} with ID or name <b>{search}</b>
      </div>
    );
  }
  if (total > length) {
    return (
      <div
        className={cn(s.subtitle, s.clickable)}
        onClick={() => {
          if (handleChangeParams && params) {
            handleChangeParams?.({
              ...params,
              userName: search,
            });
            onClose?.();
          }
        }}
      >
        More than {pluralize(userAlias ?? '', length, true)} found
      </div>
    );
  }
  return <div className={s.subtitle}>{pluralize(userAlias ?? '', length, true)} found</div>;
}
