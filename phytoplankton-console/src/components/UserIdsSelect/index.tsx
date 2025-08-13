import React, { useState } from 'react';
import { useDebounce } from 'ahooks';
import Select, { Props } from '../library/Select';
import { useUsersSearch } from '@/pages/transactions/components/UserSearchPopup/helpers';
import { getOr } from '@/utils/asyncResource';

type LocalProps = Omit<Extract<Props<string>, { mode: 'SINGLE' | 'TAGS' }>, 'options'>;

function UserIdsSelect(props: LocalProps) {
  const [searchTerm, setSearchTerm] = useState<string | undefined>();
  const debouncedSearchTerm = useDebounce(searchTerm, { wait: 500 });
  const users = useUsersSearch(debouncedSearchTerm ?? '');
  const options = getOr(users.data, { total: 0, users: [] }).users.map((val) => ({
    label: val.userId,
    value: val.userId,
  }));
  return (
    <Select
      {...props}
      options={options}
      onSearch={(searchTerm: string) => {
        setSearchTerm(searchTerm);
      }}
    />
  );
}

export default UserIdsSelect;
