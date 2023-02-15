import React, { useState } from 'react';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import { Card } from 'antd';
import Role from './Role';
import s from './index.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { AccountRole } from '@/apis';
import { ROLES_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import VerticalMenu from '@/components/library/VerticalMenu';

export default function Roles() {
  const api = useApi();
  const result = useQuery<AccountRole[]>(ROLES_LIST(), async () => {
    return await api.getRoles();
  });
  return (
    <div className={s.container}>
      <Card className={s.container}>
        <AsyncResourceRenderer resource={result.data}>
          {(roles) => <RolesLayout roles={roles} />}
        </AsyncResourceRenderer>
      </Card>
    </div>
  );
}

const RolesLayout = ({ roles }: { roles: AccountRole[] }) => {
  const [roleId, setRoleId] = useState<string>(roles[0]?.id || '');
  return (
    <VerticalMenu
      // Dont show legacy "user" role
      items={roles
        .filter((r) => r.name !== 'user')
        .map((r) => ({ key: r.id as string, title: sentenceCase(r.name as string) }))}
      active={roleId}
      minWidth={200}
      onChange={setRoleId}
    >
      <Role role={roles.find((r) => r.id == roleId) as AccountRole} />
    </VerticalMenu>
  );
};
