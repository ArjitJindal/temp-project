import { useMemo } from 'react';
import { UserOutlined } from '@ant-design/icons';
import PopupContent from './PopupContent';
import QuickFilterBase from '@/components/library/QuickFilter/QuickFilterBase';
import { useUsers } from '@/utils/user-utils';

interface Props {
  onConfirm: (users: string[]) => void;
  users: string[];
  onUpdateFilterClose?: (status: boolean) => void;
}

export function AssignmentButton(props: Props) {
  const [users, loading] = useUsers();
  const { onConfirm, onUpdateFilterClose } = props;

  const isEmpty = useMemo(() => (props?.users?.length ? false : true), [props.users]);

  const finalUsers = useMemo(() => {
    if (!loading) {
      return props.users?.map((user) => users?.[user]?.name ?? user);
    }
    return [];
  }, [props.users, users, loading]);

  return (
    <QuickFilterBase
      icon={<UserOutlined />}
      analyticsName="assigned-to-filter"
      title="Assignees"
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
      <PopupContent value={props.users} onConfirm={props.onConfirm} />
    </QuickFilterBase>
  );
}
