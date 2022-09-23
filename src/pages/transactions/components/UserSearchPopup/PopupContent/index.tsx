import React, { useEffect, useState } from 'react';
import { Radio, Input } from 'antd';
import { useDebounce } from 'ahooks';
import { Mode, User } from '../types';
import { useLastSearches, useUsers } from '../helpers';
import s from './style.module.less';
import UserList from './UserList';
import LastSearchList from './LastSearchList';
import UserFillIcon from '@/components/ui/icons/Remix/user/user-fill.react.svg';
import SearchLineIcon from '@/components/ui/icons/Remix/system/search-line.react.svg';
import { isSuccess } from '@/utils/asyncResource';

interface Props {
  initialSearch: string;
  initialMode: Mode | null;
  isVisible: boolean;
  onConfirm: (user: User, mode: Mode | null) => void;
  onCancel: () => void;
}

export default function PopupContent(props: Props) {
  const { isVisible, initialSearch, initialMode, onConfirm } = props;

  const [search, setSearch] = useState(initialSearch);
  const [mode, setMode] = useState<Mode | null>(initialMode ?? null);

  const debouncedSearch = useDebounce(search, { wait: 500 });
  const usersRes = useUsers(debouncedSearch);
  const { onAdd } = useLastSearches();

  const usersCount = isSuccess(usersRes.data) ? usersRes.data.value.total : null;
  useEffect(() => {
    if (!isVisible) {
      if (debouncedSearch !== '' && usersCount != null && usersCount > 0) {
        onAdd(debouncedSearch);
      }
    }
  }, [onAdd, isVisible, usersCount, debouncedSearch]);

  useEffect(() => {
    if (!isVisible) {
      setSearch(initialSearch);
      setMode(initialMode);
    }
  }, [isVisible, initialSearch, initialMode]);

  function handleSelectUser(user: User) {
    onConfirm(user, mode);
    onAdd(debouncedSearch);
    setSearch('');
    setMode(null);
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
        {initialMode != null && (
          <Radio.Group
            onChange={(e) => {
              setMode(e.target.value);
            }}
            value={mode}
          >
            <Radio value={'ALL'}>All users</Radio>
            <Radio value={'ORIGIN'}>Origin (Sender)</Radio>
            <Radio value={'DESTINATION'}>Destination (Receiver)</Radio>
          </Radio.Group>
        )}
      </div>
      {search !== '' ? (
        <div className={s.content}>
          <UserList
            usersRes={usersRes.data}
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
