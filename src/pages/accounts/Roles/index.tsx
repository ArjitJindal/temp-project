import React, { useState } from 'react';
import { sentenceCase } from '@antv/x6/es/util/string/format';
import { Card } from 'antd';
import { LockFilled, PlusSquareFilled } from '@ant-design/icons';
import s from './index.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { AccountRole } from '@/apis';
import { ROLE, ROLES_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import VerticalMenu from '@/components/library/VerticalMenu';
import RoleForm from '@/pages/accounts/Roles/RoleForm';
import { isValidManagedRoleName } from '@/apis/models-custom/ManagedRoleName';

export default function Roles() {
  const api = useApi();
  const result = useQuery<AccountRole[]>(ROLES_LIST(), async () => {
    return await api.getRoles();
  });

  return (
    <div className={s.container}>
      <Card className={s.container}>
        <AsyncResourceRenderer resource={result.data}>
          {(roles) => <RolesLayout roles={roles} onChange={result.refetch} />}
        </AsyncResourceRenderer>
      </Card>
    </div>
  );
}

const RolesLayout = ({ roles, onChange }: { roles: AccountRole[]; onChange: () => any }) => {
  const [key, setKey] = useState<string>(roles[0]?.id || '');
  return (
    <VerticalMenu
      items={roles
        .map((r) => ({
          key: r.id as string,
          title: sentenceCase(r.name as string),
          icon: isValidManagedRoleName(r.name) && <LockFilled className={s.icon} />,
        }))
        .concat({
          key: 'NEW',
          title: 'Create role',
          icon: <PlusSquareFilled className={s.icon} />,
        })}
      active={key}
      minWidth={200}
      onChange={setKey}
    >
      {key !== 'NEW' && <RoleFormAsync roleId={key} onChange={onChange} />}
      {key === 'NEW' && <RoleForm onChange={onChange} />}
    </VerticalMenu>
  );
};

const RoleFormAsync = ({ roleId, onChange }: { roleId: string; onChange: () => void }) => {
  const api = useApi();
  const result = useQuery<AccountRole>(ROLE(roleId), async () => {
    return await api.getRole({ roleId });
  });

  return (
    <AsyncResourceRenderer key={roleId} resource={result.data}>
      {(role) => (
        <RoleForm
          key={role.id}
          role={role}
          onChange={() => {
            result.refetch();
            onChange();
          }}
        />
      )}
    </AsyncResourceRenderer>
  );
};
