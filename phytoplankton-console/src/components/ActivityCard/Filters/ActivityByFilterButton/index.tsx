import React from 'react';
import AccountCircleOutline from '@/components/ui/icons/Remix/user/account-circle-line.react.svg';
import { useUsers } from '@/utils/api/auth';
import ListQuickFilter from '@/components/library/QuickFilter/subtypes/ListQuickFilter';
import { getAccountUserName } from '@/utils/user-utils';

interface Props {
  initialState: string[];
  onConfirm: (newState: string[] | undefined) => void;
}

export default function ActivityByFilterButton(props: Props) {
  const { initialState, onConfirm } = props;
  const { users, isLoading } = useUsers();
  const options = isLoading
    ? []
    : Object.values(users).map((user) => ({
        value: user.id,
        label: getAccountUserName(user),
      }));
  return (
    <ListQuickFilter
      title={'Activity by'}
      key={'id-search'}
      icon={<AccountCircleOutline />}
      value={initialState}
      onChange={onConfirm}
      options={options}
      mode={'MULTIPLE'}
    />
  );
}
