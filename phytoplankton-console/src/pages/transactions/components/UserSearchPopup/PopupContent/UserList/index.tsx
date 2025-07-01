import React from 'react';
import pluralize from 'pluralize';
import { List } from 'antd';
import s from './style.module.less';
import UserItem from './UserItem';
import { AsyncResource } from '@/utils/asyncResource';
import { AllUsersTableItem } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Spinner from '@/components/library/Spinner';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
interface Props {
  selectedUser: AllUsersTableItem | null;
  onSelectUser: (user: AllUsersTableItem) => void;
  search: string;
  usersRes: AsyncResource<{
    total: number;
    users: AllUsersTableItem[];
  }>;
}

export default function UserList(props: Props) {
  const { usersRes, selectedUser, search, onSelectUser } = props;
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
              {renderMessage(users, total, search, settings.userAlias)}
              {users.length > 0 && (
                <List<AllUsersTableItem>
                  dataSource={users}
                  renderItem={(nextUser) => (
                    <UserItem
                      user={nextUser}
                      key={nextUser.userId}
                      isActive={nextUser.userId === selectedUser?.userId}
                      onClick={() => {
                        onSelectUser(nextUser);
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

function renderMessage(
  users: AllUsersTableItem[],
  total: number,
  search: string,
  userAlias?: string,
) {
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
      <div className={s.subtitle}>More than {pluralize(userAlias ?? '', length, true)} found</div>
    );
  }
  return <div className={s.subtitle}>{pluralize(userAlias ?? '', length, true)} found</div>;
}
