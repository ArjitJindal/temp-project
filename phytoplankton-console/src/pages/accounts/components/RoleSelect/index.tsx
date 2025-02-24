import { startCase } from 'lodash';
import React from 'react';
import { getSantiziedRoleName } from '../../utils';
import Select, { SingleProps as SelectSingleProps } from '@/components/library/Select';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { AccountRole } from '@/apis';
import { ROLES_LIST } from '@/utils/queries/keys';
import { getOr, isLoading } from '@/utils/asyncResource';

interface Props extends Partial<SelectSingleProps<string>> {}

export function RoleSelect(props: Props) {
  const { ...rest } = props;
  const api = useApi();
  const rolesResp = useQuery<AccountRole[]>(ROLES_LIST(), async () => {
    return await api.getRoles();
  });

  return (
    <Select<string>
      {...rest}
      isLoading={isLoading(rolesResp.data)}
      options={getOr(rolesResp.data, []).map((name) => ({
        value: name.name,
        label: startCase(getSantiziedRoleName(name.name)),
      }))}
    />
  );
}
