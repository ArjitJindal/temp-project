import React from 'react';
import pluralize from 'pluralize';
import { List } from 'antd';
import { User } from '../../types';
import s from './style.module.less';
import UserItem from './UserItem';
import { AsyncResource } from '@/utils/asyncResource';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import Spinner from '@/components/library/Spinner';

interface Props {
  selectedUser: User | null;
  onSelectUser: (user: User) => void;
  search: string;
  usersRes: AsyncResource<{
    total: number;
    users: User[];
  }>;
}

export default function UserList(props: Props) {
  const { usersRes, selectedUser, search, onSelectUser } = props;

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
              {renderMessage(users, total, search)}
              {users.length > 0 && (
                <List<InternalBusinessUser | InternalConsumerUser>
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

function renderMessage(users: User[], total: number, search: string) {
  const length = users.length;
  if (length === 0) {
    return (
      <div className={s.nothingFound}>
        We could not find a user with ID or name <b>{search}</b>
      </div>
    );
  }
  if (total > length) {
    return <div className={s.subtitle}>More than {length} users found</div>;
  }
  return <div className={s.subtitle}>{pluralize('user', length, true)} found</div>;
}
