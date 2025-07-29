import { Avatar } from 'antd';
import cn from 'clsx';
import { useMemo } from 'react';
import { Resource } from '@flagright/lib/utils';
import s from './index.module.less';
import { colorSchema } from '@/components/utils/AssigneesDropdown/utils';
import { useHasResources, useSortedUsers } from '@/utils/user-utils';
import { Account, Assignment } from '@/apis';
import AccountTag from '@/components/AccountTag';
import ErrorBoundary from '@/components/utils/ErrorBoundary';
import Select from '@/components/library/Select';

interface Props {
  editing: boolean;
  assignments: Array<Assignment>;
  onChange?: (assignees: string[]) => void;
  maxAssignees?: number;
  placeholder?: string;
  fixSelectorHeight?: boolean;
  customFilter?: (option: Account) => boolean;
  requiredResources?: Resource[];
}

const AssigneesDropdownContent: React.FC<Props> = ({
  assignments,
  editing,
  onChange,
  placeholder,
  customFilter,
  fixSelectorHeight = false,
  requiredResources = ['write:::case-management/case-assignment/*'],
}) => {
  const [users, loadingUsers] = useSortedUsers();
  const canEditAssignees = useHasResources(requiredResources);

  const filteredUsers = useMemo(() => {
    if (!customFilter) {
      return users;
    }

    return users.filter((user) => customFilter(user));
  }, [users, customFilter]);

  const options = filteredUsers.map((user, index) => ({
    value: user.id,
    label: (
      <div className={s.item}>
        <Avatar
          size="small"
          className={s.avatar}
          style={{
            color: colorSchema[index % 4].text,
            backgroundColor: colorSchema[index % 4].background,
          }}
        >
          {user.email.toUpperCase().charAt(0)}
        </Avatar>
        <span>{user.name}</span>
      </div>
    ),
    searchText: `${user.name} ${user.email}`,
  }));

  return editing && canEditAssignees ? (
    <Select<string>
      className={
        cn(s.select, fixSelectorHeight ? s.fixSelectorHeight : '') +
        (assignments.length === 0 ? ' unassigned ' : '')
      }
      mode="MULTIPLE"
      allowClear
      onSearch={() => {}}
      style={{ width: '100%' }}
      isDisabled={loadingUsers}
      placeholder={loadingUsers ? 'Loading...' : placeholder ?? 'Unassigned'}
      onChange={(values) => {
        if (onChange && values) {
          onChange(values);
        }
      }}
      value={
        loadingUsers
          ? []
          : assignments
              .filter((assignment) => assignment.assigneeUserId !== undefined)
              .map((assignment) => assignment.assigneeUserId)
      }
      options={options}
      isLoading={loadingUsers}
    />
  ) : (
    <div className={s.assigneesList}>
      {assignments?.map((assignment) => (
        <AccountTag key={assignment.assigneeUserId} accountId={assignment.assigneeUserId} />
      ))}
    </div>
  );
};

export const AssigneesDropdown: React.FC<Props> = (props) => {
  return (
    <ErrorBoundary>
      <AssigneesDropdownContent {...props} />
    </ErrorBoundary>
  );
};
