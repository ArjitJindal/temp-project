import React, { useState } from 'react';
import { startCase } from 'lodash';
import { Card } from 'antd';
import { LockFilled } from '@ant-design/icons';
import s from './index.module.less';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { AccountRole } from '@/apis';
import { ROLE, ROLES_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import VerticalMenu from '@/components/library/VerticalMenu';
import RoleForm from '@/pages/accounts/Roles/RoleForm';
import { isValidManagedRoleName } from '@/apis/models-custom/ManagedRoleName';
import Button from '@/components/library/Button';

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
  const [isCreateRoleForm, setIsCreateRoleForm] = useState<boolean>(false);
  return (
    <div>
      <VerticalMenu
        testId="roles-menu"
        additionalMenuTop={
          <Button
            type="TETRIARY"
            size="MEDIUM"
            style={{ width: '100%', position: 'relative', marginBottom: '1rem' }}
            onClick={() => setIsCreateRoleForm(true)}
            requiredPermissions={['settings:organisation:write']}
          >
            + Create role
          </Button>
        }
        items={roles.map((r) => ({
          key: r.id,
          title: startCase(r.name),
          icon: isValidManagedRoleName(r.name) && (
            <span className={s.icon}>
              <LockFilled />
            </span>
          ),
        }))}
        active={key}
        minWidth={200}
        onChange={(newKey) => {
          setKey(newKey);
          setIsCreateRoleForm(false);
        }}
      >
        {isCreateRoleForm ? (
          <RoleForm onChange={onChange} />
        ) : (
          <RoleFormAsync roleId={key} onChange={onChange} />
        )}
      </VerticalMenu>
    </div>
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
          onChange={(onDelete: boolean, onUpdate: boolean) => {
            if (!onDelete && onUpdate) {
              result.refetch();
            }
            onChange();
          }}
        />
      )}
    </AsyncResourceRenderer>
  );
};
