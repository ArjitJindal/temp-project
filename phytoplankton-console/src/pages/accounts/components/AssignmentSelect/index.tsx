import React from 'react';
import { Assignment } from '@/apis';
import { AssigneesDropdown } from '@/components/AssigneesDropdown';
import { InputProps } from '@/components/library/Form';
import { AnyAccount } from '@/utils/user-utils';

interface Props extends InputProps<string[]> {
  placeholder?: string;
  customFilter?: (option: AnyAccount) => boolean;
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
      onChange={async (value) => {
        inputProps?.onChange?.(value);
      }}
      requiredResources={['write:::accounts/overview/*']}
    />
  );
}
