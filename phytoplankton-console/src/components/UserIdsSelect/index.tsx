import React, { useState } from 'react';
import { useDebounce } from 'ahooks';
import Select, { Props } from '../library/Select';
import { useUsersFind } from '@/utils/api/users';
import { getOr } from '@/utils/asyncResource';

type LocalProps = Omit<
  Extract<Props<string>, { mode: 'SINGLE' | 'MULTIPLE' | 'MULTIPLE_DYNAMIC' }>,
  'options'
>;

function UserIdsSelect(props: LocalProps) {
  const [searchTerm, setSearchTerm] = useState<string | undefined>();
  const debouncedSearchTerm = useDebounce(searchTerm, { wait: 500 });
  const users = useUsersFind({ search: debouncedSearchTerm ?? '' });
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
