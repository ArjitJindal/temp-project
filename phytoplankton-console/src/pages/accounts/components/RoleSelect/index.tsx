import React from 'react';
import { formatRoleName } from '../../utils';
import Select, { SingleProps as SelectSingleProps } from '@/components/library/Select';
import { useRoles } from '@/utils/api/auth';

interface Props extends Partial<SelectSingleProps<string>> {}

export function RoleSelect(props: Props) {
  const { ...rest } = props;
  const { rolesList, isLoading } = useRoles();

  return (
    <Select<string>
      {...rest}
      isLoading={isLoading}
      options={rolesList.map((role) => ({
        value: role.name,
        label: formatRoleName(role.name),
      }))}
    />
  );
}
