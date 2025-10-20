import { useMemo, useState } from 'react';
import { Resource } from '@flagright/lib/utils';
import cn from 'clsx';
import s from './index.module.less';
import Avatar from '@/components/library/Avatar';
import { getDisplayedUserInfo, useHasResources, useSortedUsers } from '@/utils/user-utils';
import { Account, Assignment } from '@/apis';
import AccountTag from '@/components/AccountTag';
import ErrorBoundary from '@/components/utils/ErrorBoundary';
import Select from '@/components/library/Select';
import CloseLineIcon from '@/components/ui/icons/Remix/system/close-line.react.svg';
import { AsyncResource, isLoading } from '@/utils/asyncResource';
import { useDeepEqualEffect } from '@/utils/hooks';

interface Props {
  editing: boolean;
  assignments: Array<Assignment>;
  onChange?: (assignees: string[]) => Promise<void>;
  maxAssignees?: number;
  placeholder?: string;
  customFilter?: (option: Account) => boolean;
  mutationRes?: AsyncResource;
  requiredResources?: Resource[];
}

const AssigneesDropdownContent: React.FC<Props> = ({
  assignments,
  editing,
  onChange,
  placeholder,
  customFilter,
  requiredResources = ['write:::case-management/case-assignment/*'],
  mutationRes,
}) => {
  const [users, loadingUsers] = useSortedUsers();
  const canEditAssignees = useHasResources(requiredResources);

  const filteredUsers = useMemo(() => {
    if (!customFilter) {
      return users;
    }

    return users.filter((user) => customFilter(user));
  }, [users, customFilter]);

  const options = filteredUsers.map((user) => ({
    value: user.id,
    label: (
      <div className={s.item}>
        <Avatar size="xs" user={user} />
        <span data-cy={'user-name'}>{user.name}</span>
      </div>
    ),
    searchText: `${user.name} ${user.email}`,
  }));

  const tagsStackParams = useMemo(() => {
    return {
      enabled: true,
      transparentBackground: true,
      tagsOrder: (a, b) => {
        const userA = users.find((x) => x.id === a.value);
        const nameA = getDisplayedUserInfo(userA).name;
        const userB = users.find((x) => x.id === b.value);
        const nameB = getDisplayedUserInfo(userB).name;
        return nameA.length - nameB.length;
      },
    };
  }, [users]);

  const values = assignments
    .filter((assignment) => assignment.assigneeUserId !== undefined)
    .map((assignment) => assignment.assigneeUserId);

  const [localValue, setLocalValue] = useState(values);

  useDeepEqualEffect(() => {
    setLocalValue(values);
  }, [values]);

  const [isBusy, setIsBusy] = useState(false);

  const handleChange = (values) => {
    setLocalValue(values);
    if (onChange && values) {
      setIsBusy(true);
      onChange(values).then(
        () => {
          setIsBusy(false);
        },
        () => {
          setIsBusy(false);
        },
      );
    }
  };

  return editing && canEditAssignees ? (
    <Select<string>
      testId={'assignee-dropdown'}
      mode="MULTIPLE"
      tagsStack={tagsStackParams}
      allowClear={false}
      onSearch={() => {}}
      isDisabled={loadingUsers}
      placeholder={loadingUsers ? 'Loading...' : placeholder ?? 'Unassigned'}
      onChange={handleChange}
      value={localValue}
      options={options}
      isLoading={loadingUsers || isBusy || (mutationRes != null && isLoading(mutationRes))}
      tagRenderer={({
        option,
        isHovered,
        isShadowed,
        isOptionFound,
        isOnTop,
        isDisabled,
        onRemove,
      }) => {
        const user = users.find((x) => x.id === option.value);

        const assignment = assignments.find((x) => x.assigneeUserId === option.value);

        return (
          <div className={cn(s.tagWrapper, isShadowed && s.isShadowed, isHovered && s.isHovered)}>
            {assignment && (
              <AccountTag
                accountId={assignment.assigneeUserId}
                hideUserName={!isOnTop && !isHovered}
              />
            )}
            {!assignment && user && (
              <AccountTag accountId={user.id} hideUserName={!isOnTop && !isHovered} />
            )}
            {isOptionFound && !isDisabled && (
              <CloseLineIcon
                className={s.removeIcon}
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              />
            )}
          </div>
        );
      }}
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
