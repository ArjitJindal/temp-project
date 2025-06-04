import React from 'react';
import { formatRoleName } from '../../utils';
import Select, { SingleProps as SelectSingleProps } from '@/components/library/Select';
import { useRoles } from '@/utils/user-utils';

interface Props extends Partial<SelectSingleProps<string>> {}

export function RoleSelect(props: Props) {
  const { ...rest } = props;
  const [roles, isLoading] = useRoles();

  return (
    <Select<string>
      {...rest}
      isLoading={isLoading}
      options={roles.map((role) => ({
        value: role.name,
        label: formatRoleName(role.name),
      }))}
    />
  );
}
