import { useMemo } from 'react';
import PopupContent from './PopupContent';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';
import { useUsers } from '@/utils/api/auth';

interface Props {
  onConfirm: (users: string[]) => void;
  users: string[];
  onUpdateFilterClose?: (status: boolean) => void;
  title: string;
  includeUnassigned?: boolean;
  Icon?: React.ReactNode;
}

export function AccountsFilter(props: Props) {
  const { users, isLoading } = useUsers();
  const { onConfirm, onUpdateFilterClose } = props;

  const isEmpty = useMemo(() => (props?.users?.length ? false : true), [props.users]);

  const finalUsers = useMemo(() => {
    if (!isLoading) {
      return props.users?.map((user) => users?.[user]?.name ?? user);
    }
    return [];
  }, [props.users, users, isLoading]);

  return (
    <QuickFilterBase
      icon={props?.Icon ?? undefined}
      analyticsName="assigned-to-filter"
      title={props.title ?? 'Assigned to'}
      buttonText={isEmpty ? undefined : finalUsers.join(', ')}
      onClear={
        isEmpty
          ? undefined
          : () => {
              onConfirm([]);
            }
      }
      onUpdateFilterClose={onUpdateFilterClose}
    >
      <PopupContent
        value={props.users}
        onConfirm={props.onConfirm}
        includeUnassigned={props?.includeUnassigned ?? false}
      />
    </QuickFilterBase>
  );
}
