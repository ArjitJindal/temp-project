import { Avatar, Select } from 'antd';
import cn from 'clsx';
import { LoadingOutlined } from '@ant-design/icons';
import { useMemo } from 'react';
import s from './index.module.less';
import { colorSchema } from '@/components/utils/AssigneesDropdown/utils';
import { useHasPermissions, useSortedUsers } from '@/utils/user-utils';
import { Account, Assignment, Permission } from '@/apis';
import AccountTag from '@/components/AccountTag';
import ArrowDropDownFill from '@/components/ui/icons/Remix/system/arrow-drop-down-fill.react.svg';
import ErrorBoundary from '@/components/utils/ErrorBoundary';

interface Props {
  editing: boolean;
  assignments: Array<Assignment>;
  onChange?: (assignees: string[]) => void;
  maxAssignees?: number;
  placeholder?: string;
  fixSelectorHeight?: boolean;
  customFilter?: (option: Account) => boolean;
  requiredPermissions?: Permission[];
}

const AssigneesDropdownContent: React.FC<Props> = ({
  assignments,
  editing,
  onChange,
  maxAssignees,
  placeholder,
  customFilter,
  fixSelectorHeight = false,
  requiredPermissions = ['case-management:case-assignment:write'],
}) => {
  const [users, loadingUsers] = useSortedUsers();
  const canEditAssignees = useHasPermissions(requiredPermissions);

  const filteredUsers = useMemo(() => {
    if (!customFilter) {
      return users;
    }

    return users.filter((user) => customFilter(user));
  }, [users, customFilter]);
  return editing && canEditAssignees ? (
    <Select<string[]>
      open={maxAssignees && assignments.length >= maxAssignees ? false : undefined}
      className={
        cn(s.select, fixSelectorHeight ? s.fixSelectorHeight : '') +
        (assignments.length === 0 ? ' unassigned ' : '')
      }
      mode={'multiple'}
      allowClear
      filterOption={(input, option) => {
        if (!input || !option) {
          return false;
        }

        const accountId = option.value;
        const selectedUser = users.find((user) => user.id === accountId);

        if (!selectedUser) {
          return false;
        }

        return selectedUser.name.includes(input) || selectedUser.email.includes(input);
      }}
      style={{ width: '100%' }}
      disabled={loadingUsers}
      placeholder={
        loadingUsers ? (
          <>
            <LoadingOutlined /> Loading...
          </>
        ) : (
          placeholder ?? 'Unassigned'
        )
      }
      onChange={onChange}
      value={
        loadingUsers
          ? []
          : assignments
              .filter((assignment) => assignment.assigneeUserId !== undefined)
              .map((assignment) => assignment.assigneeUserId)
      }
      suffixIcon={<ArrowDropDownFill />}
    >
      {filteredUsers.map((user, index) => (
        <Select.Option key={user.id}>
          <div className={s.item}>
            <Avatar
              size="small"
              className={s.avatar}
              style={{
                color: colorSchema[index % 4].text,
                backgroundColor: colorSchema[index % 4].background,
              }}
            >
              {' '}
              {user.email.toUpperCase().charAt(0)}
            </Avatar>
            <span>{user.name}</span>
          </div>
        </Select.Option>
      ))}
    </Select>
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
