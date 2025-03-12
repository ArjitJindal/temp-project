import React, { useMemo, useState } from 'react';
import { Card } from 'antd';
import { LockFilled } from '@ant-design/icons';
import s from './index.module.less';
import { exportRolesDetails } from './utils';
import { getSantiziedRoleName, formatRoleName } from '@/pages/accounts/utils';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { AccountRole } from '@/apis';
import { ROLE, ROLES_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import VerticalMenu from '@/components/library/VerticalMenu';
import RoleForm from '@/pages/accounts/Roles/RoleForm';
import { isValidManagedRoleName } from '@/apis/models-custom/ManagedRoleName';
import Button from '@/components/library/Button';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr } from '@/utils/asyncResource';

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
  const existingRoleNames = useMemo(() => roles.map((r) => r.name), [roles]);
  const [isDemoModeRes] = useDemoMode();
  const isDemoMode = getOr(isDemoModeRes, false);

  // removing demo rule if not in demo mode
  if (!isDemoMode) {
    roles = roles.filter((role) => !role.name.includes('demo-'));
  }

  return (
    <div>
      <VerticalMenu
        testId="roles-menu"
        additionalMenuTop={
          <div>
            <Button
              type="TETRIARY"
              size="MEDIUM"
              style={{ width: '100%', position: 'relative', marginBottom: '1rem' }}
              onClick={() => setIsCreateRoleForm(true)}
              requiredPermissions={['roles:overview:write']}
            >
              + Create role
            </Button>
            <Button
              type="TETRIARY"
              size="MEDIUM"
              style={{ width: '100%', position: 'relative', marginBottom: '1rem' }}
              onClick={() => exportRolesDetails(roles)}
              requiredPermissions={['roles:overview:read']}
            >
              <DownloadLineIcon height={12} /> Download
            </Button>
          </div>
        }
        items={roles.map((r) => ({
          key: r.id,
          title: formatRoleName(r.name),
          icon: isValidManagedRoleName(getSantiziedRoleName(r.name)) && (
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
          <RoleForm onChange={onChange} existingRoleNames={existingRoleNames} type="create" />
        ) : (
          <RoleFormAsync roleId={key} onChange={onChange} existingRoleNames={existingRoleNames} />
        )}
      </VerticalMenu>
    </div>
  );
};

type RoleFormAsyncProps = {
  roleId: string;
  onChange: () => void;
  existingRoleNames: string[];
};

const RoleFormAsync = (props: RoleFormAsyncProps) => {
  const { roleId, onChange, existingRoleNames } = props;
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
          existingRoleNames={existingRoleNames}
          type="edit"
        />
      )}
    </AsyncResourceRenderer>
  );
};
