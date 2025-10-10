import React from 'react';
import AccountCircleOutline from '@/components/ui/icons/Remix/user/account-circle-line.react.svg';
import { useUsers } from '@/utils/user-utils';
import ListQuickFilter from '@/components/library/QuickFilter/subtypes/ListQuickFilter';

interface Props {
  initialState: string[];
  onConfirm: (newState: string[] | undefined) => void;
}

export default function ActivityByFilterButton(props: Props) {
  const { initialState, onConfirm } = props;
  const [users, loadingUsers] = useUsers();
  const options = loadingUsers
    ? []
    : Object.values(users).map((key) => ({
        value: key.id,
        label: key.name ?? key.email ?? key.id,
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
