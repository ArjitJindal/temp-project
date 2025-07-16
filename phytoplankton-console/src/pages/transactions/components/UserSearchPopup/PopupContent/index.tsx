import React, { useEffect, useState } from 'react';
import { useDebounce } from 'ahooks';
import { useLastSearches, useUsersSearch } from '../helpers';
import s from './style.module.less';
import UserList from './UserList';
import LastSearchList from './LastSearchList';
import SearchLineIcon from '@/components/ui/icons/Remix/system/search-line.react.svg';
import { isSuccess } from '@/utils/asyncResource';
import { AllUsersTableItemPreview, UserType } from '@/apis';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import TextInput from '@/components/library/TextInput';
import { UserSearchParams } from '@/pages/users/users-list';
interface Props {
  initialSearch: string;
  isVisible: boolean;
  onConfirm: (user: AllUsersTableItemPreview) => void;
  onCancel: () => void;
  onEnterInput: (userId: string) => void;
  userType?: UserType;
  handleChangeParams?: (params: UserSearchParams) => void;
  params?: UserSearchParams;
  onClose?: () => void;
}

export default function PopupContent(props: Props) {
  const {
    isVisible,
    initialSearch,
    onConfirm,
    onEnterInput,
    userType,
    handleChangeParams,
    params,
    onClose,
  } = props;
  const settings = useSettings();

  const [search, setSearch] = useState(initialSearch);

  const debouncedSearch = useDebounce(search, { wait: 500 });
  const usersRes = useUsersSearch(debouncedSearch, userType);
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

  function handleSelectUser(user: AllUsersTableItemPreview) {
    onConfirm(user);
    onAdd(debouncedSearch);
    setSearch('');
  }
  // todo: i18n
  return (
    <div className={s.root}>
      <div className={s.header}>
        <TextInput
          iconRight={search === '' ? <SearchLineIcon className={s.searchIcon} /> : undefined}
          placeholder={`Search ${settings.userAlias} name or ID`}
          value={search}
          onChange={(newValue) => setSearch(newValue || '')}
          onEnterKey={() => {
            if (isSuccess(usersRes.data)) {
              const uniqueMatch = usersRes.data.value.total === 1;
              if (uniqueMatch) {
                const foundUserId = usersRes.data.value.users[0].userId;
                onEnterInput(foundUserId);
              }
            }
          }}
          allowClear
        />
      </div>
      {search !== '' ? (
        <div className={s.content}>
          <UserList
            handleChangeParams={handleChangeParams}
            usersRes={usersRes.data}
            selectedUser={null}
            search={debouncedSearch}
            onSelectUser={handleSelectUser}
            params={params}
            onClose={onClose}
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
