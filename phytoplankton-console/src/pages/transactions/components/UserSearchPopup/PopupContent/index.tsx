import React, { useEffect, useState } from 'react';
import { Input } from 'antd';
import { useDebounce } from 'ahooks';
import { useLastSearches, useUsers } from '../helpers';
import s from './style.module.less';
import UserList from './UserList';
import LastSearchList from './LastSearchList';
import SearchLineIcon from '@/components/ui/icons/Remix/system/search-line.react.svg';
import { isSuccess } from '@/utils/asyncResource';
import { AllUsersTableItem } from '@/apis';

interface Props {
  initialSearch: string;
  isVisible: boolean;
  onConfirm: (user: AllUsersTableItem) => void;
  onCancel: () => void;
  onEnterInput: (userId: string) => void;
}

export default function PopupContent(props: Props) {
  const { isVisible, initialSearch, onConfirm, onEnterInput } = props;

  const [search, setSearch] = useState(initialSearch);

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
    }
  }, [isVisible, initialSearch]);

  function handleSelectUser(user: AllUsersTableItem) {
    onConfirm(user);
    onAdd(debouncedSearch);
    setSearch('');
  }
  // todo: i18n
  return (
    <div className={s.root}>
      <div className={s.header}>
        <Input
          suffix={search === '' && <SearchLineIcon className={s.searchIcon} />}
          placeholder="Search user name or ID"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onEnterInput(search);
            }
          }}
          allowClear
        />
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
