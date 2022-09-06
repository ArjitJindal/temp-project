import React, { useState } from 'react';
import { Input } from 'antd';
import { useDebounce } from 'ahooks';
import { User } from '../types';
import { useUsers } from '../helpers';
import s from './style.module.less';
import UserList from './UserList';
import UserFillIcon from '@/components/ui/icons/Remix/user/user-fill.react.svg';
import SearchLineIcon from '@/components/ui/icons/Remix/system/search-line.react.svg';

interface Props {
  initialSearch: string;
  onConfirm: (user: User) => void;
  onCancel: () => void;
}

export default function PopupContent(props: Props) {
  const { initialSearch, onConfirm } = props;

  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, { wait: 500 });
  const usersRes = useUsers(debouncedSearch);

  function handleSelectUser(user: User) {
    onConfirm(user);
  }

  // todo: i18n
  return (
    <div className={s.root}>
      <div className={s.header}>
        <div className={s.title}>
          <UserFillIcon className={s.icon} />
          <span>Find a user</span>
        </div>
        <Input
          suffix={<SearchLineIcon className={s.searchIcon} />}
          placeholder="Search user name or ID"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />
      </div>
      <div className={s.content}>
        <UserList
          usersRes={usersRes}
          selectedUser={null}
          search={debouncedSearch}
          onSelectUser={handleSelectUser}
        />
      </div>
    </div>
  );
}
