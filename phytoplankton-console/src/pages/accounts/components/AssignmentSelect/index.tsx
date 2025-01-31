import React from 'react';
import { Account, Assignment } from '@/apis';
import { AssigneesDropdown } from '@/pages/case-management/components/AssigneesDropdown';
import { InputProps } from '@/components/library/Form';

interface Props extends InputProps<string[]> {
  placeholder?: string;
  customFilter?: (option: Account) => boolean;
}

export function AssignmentSelect(props: Props) {
  const { placeholder, customFilter, ...inputProps } = props;

  const assignments = (inputProps.value ?? []).map(
    (x): Assignment => ({
      assigneeUserId: x,
      timestamp: Date.now(),
    }),
  );

  return (
    <AssigneesDropdown
      maxAssignees={1}
      editing={true}
      placeholder={placeholder}
      customFilter={customFilter}
      assignments={assignments}
      onChange={(value) => {
        inputProps?.onChange?.(value);
      }}
      requiredPermissions={['accounts:overview:write']}
    />
  );
}
