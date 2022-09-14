import React, { useEffect, useState } from 'react';
import { Input } from 'antd';
import { useDebounce } from 'ahooks';
import { User } from '../types';
import { useLastSearches, useUsers } from '../helpers';
import s from './style.module.less';
import UserList from './UserList';
import LastSearchList from './LastSearchList';
import UserFillIcon from '@/components/ui/icons/Remix/user/user-fill.react.svg';
import SearchLineIcon from '@/components/ui/icons/Remix/system/search-line.react.svg';
import { isSuccess } from '@/utils/asyncResource';

interface Props {
  initialSearch: string;
  isVisible: boolean;
  onConfirm: (user: User) => void;
  onCancel: () => void;
}

export default function PopupContent(props: Props) {
  const { isVisible, initialSearch, onConfirm } = props;

  const [search, setSearch] = useState(initialSearch);
  const debouncedSearch = useDebounce(search, { wait: 500 });
  const usersRes = useUsers(debouncedSearch);
  const { onAdd } = useLastSearches();

  const usersCount = isSuccess(usersRes) ? usersRes.value.total : null;
  useEffect(() => {
    if (!isVisible) {
      if (debouncedSearch !== '' && usersCount != null && usersCount > 0) {
        onAdd(debouncedSearch);
      }
    }
  }, [onAdd, isVisible, usersCount, debouncedSearch]);

  function handleSelectUser(user: User) {
    onConfirm(user);
    onAdd(debouncedSearch);
    setSearch('');
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
          suffix={search === '' && <SearchLineIcon className={s.searchIcon} />}
          placeholder="Search user name or ID"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          allowClear
        />
      </div>
      {search !== '' ? (
        <div className={s.content}>
          <UserList
            usersRes={usersRes}
            selectedUser={null}
            search={debouncedSearch}
            onSelectUser={handleSelectUser}
          />
        </div>
      ) : (
        <div className={s.content}>
          <LastSearchList onSelect={setSearch} />
        </div>
      )}
    </div>
  );
}
