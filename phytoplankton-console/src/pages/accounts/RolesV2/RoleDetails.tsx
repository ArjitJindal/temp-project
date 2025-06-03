import { useCallback, useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import s from './style.module.less';
import Permissions from './Permissions';
import RoleHeader from './RoleHeader';
import { PermissionStatementManager, validateRoleName } from './utils';
import * as Card from '@/components/ui/Card';
import Button from '@/components/library/Button';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { PERMISSIONS, ROLES_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import {
  AccountRole,
  CreateAccountRole,
  PermissionStatements,
  Permission,
  PermissionsAction,
} from '@/apis';
import { getErrorMessage } from '@/utils/lang';
import { useAuth0User, useRoles } from '@/utils/user-utils';
import Confirm from '@/components/utils/Confirm';

interface RoleDetailsProps {
  mode: 'view' | 'edit';
  role?: AccountRole;
  onCancelEdit: () => void;
  handleSuccess: () => void;
  setIsEditing: (isEditing: boolean) => void;
}

export default function RoleDetails({
  mode,
  role,
  onCancelEdit,
  handleSuccess,
  setIsEditing,
}: RoleDetailsProps) {
  const api = useApi();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const auth0User = useAuth0User();
  const [allRoles, , refetchRoles] = useRoles();
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(role?.name || '');
  const [description, setDescription] = useState(role?.description || '');
  const [query, setQuery] = useState('');
  const [currentStatements, setCurrentStatements] = useState<PermissionStatements[]>(
    role?.statements || [],
  );

  const permissionsQuery = useQuery(PERMISSIONS(query), async () => {
    return await api.getAllPermissions({ search: query });
  });

  const tenantName = auth0User?.tenantName?.toLowerCase() || '';
  const statementManager = useMemo(() => new PermissionStatementManager(tenantName), [tenantName]);

  useEffect(() => {
    setName(role?.name || '');
    setDescription(role?.description || '');
    setCurrentStatements(role?.statements || []);
  }, [role]);

  const handlePermissionChange = useCallback(
    (permission: Permission, action: PermissionsAction, checked: boolean) => {
      if (mode !== 'edit') {
        return;
      }
      setCurrentStatements((prevStatements) => {
        const permPath = permission.split('::::')[0];
        let newStatements = prevStatements;

        if (checked) {
          newStatements = statementManager.addPermission(permPath, action, newStatements);

          if (action === 'write') {
            newStatements = statementManager.addPermission(permPath, 'read', newStatements);
          }
        } else {
          newStatements = statementManager.removePermission(
            permPath,
            action,
            newStatements,
            permissionsQuery.data,
          );
        }

        const optimizedStatements = statementManager.optimizeStatements(
          newStatements,
          permissionsQuery.data,
        );

        return optimizedStatements;
      });
    },
    [mode, statementManager, permissionsQuery.data],
  );

  const handleSave = useCallback(async () => {
    setIsLoading(true);

    const validation = validateRoleName(name);
    if (!validation.isValid) {
      message.error(validation.error);
      setIsLoading(false);
      return;
    }

    const trimmedName = name.trim().toLowerCase();
    if (!role?.id && allRoles.some((r) => r.name.toLowerCase() === trimmedName)) {
      message.error(`Role name: ${name} already exists`);
      setIsLoading(false);
      return;
    }

    const optimizedStatements = currentStatements;

    const payload = {
      name: trimmedName,
      description: description.trim(),
      permissions: [],
      statements: optimizedStatements,
    };

    try {
      if (!role?.id) {
        await api.createRole({ CreateAccountRole: payload as CreateAccountRole });
        message.success(`Role '${payload.name}' created successfully.`);
        queryClient.invalidateQueries(ROLES_LIST());
        handleSuccess?.();
      } else if (role?.id) {
        await api.updateRole({ roleId: role.id, AccountRole: { id: role.id, ...payload } });
        message.success(`Role '${payload.name}' updated successfully.`);
        queryClient.invalidateQueries(ROLES_LIST());
        handleSuccess?.();
      } else {
        throw new Error('Cannot update role without an ID.');
      }
    } catch (error) {
      message.error(`Failed to ${!role?.id ? 'create' : 'update'} role: ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [name, currentStatements, description, role?.id, api, queryClient, handleSuccess, allRoles]);

  const handleDelete = useCallback(async () => {
    if (!role?.id) {
      message.error('Cannot delete role: missing role ID');
      return;
    }

    setIsLoading(true);
    try {
      await api.deleteRole({ roleId: role.id });
      refetchRoles();
      message.success(`Role "${role.name}" has been deleted`);
      navigate('/accounts/roles');
    } catch (error) {
      message.error(`Failed to delete role: ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [api, role, navigate, refetchRoles]);

  const handleNameChange = useCallback((newName: string) => {
    setName(newName);
  }, []);

  const handleDescriptionChange = useCallback((newDesc: string) => {
    setDescription(newDesc);
  }, []);

  const handleCancelEdit = useCallback(() => {
    onCancelEdit?.();
  }, [onCancelEdit]);

  const handleSwitchToEdit = useCallback(() => {
    setIsEditing(true);
  }, [setIsEditing]);

  const modifiedRole = useMemo(
    () => ({
      ...role,
      statements: currentStatements,
    }),
    [role, currentStatements],
  );

  return (
    <div className={s.roleDetailsContainer}>
      <RoleHeader
        mode={mode}
        roleId={role?.id}
        isLoading={isLoading}
        name={name}
        description={description}
        onNameChange={handleNameChange}
        onDescriptionChange={handleDescriptionChange}
        onEditClick={handleSwitchToEdit}
      />
      <Card.Root className={s.cardContent}>
        <AsyncResourceRenderer resource={permissionsQuery.data}>
          {(permissions) => (
            <Permissions
              permissions={permissions}
              mode={mode}
              role={modifiedRole}
              onPermissionChange={handlePermissionChange}
              onQueryChange={setQuery}
              query={query}
            />
          )}
        </AsyncResourceRenderer>
      </Card.Root>
      {mode === 'edit' && (
        <Card.Root className={s.stickyFooter}>
          <Card.Section direction="horizontal" className={s.footer}>
            <Button
              type="PRIMARY"
              onClick={handleSave}
              isLoading={isLoading}
              testName="save-role-button"
            >
              {role?.id ? 'Save' : 'Create'}
            </Button>
            <Button type="SECONDARY" onClick={handleCancelEdit} isDisabled={isLoading}>
              Cancel
            </Button>
            {role?.id && (
              <Confirm
                title="Delete Role"
                text={`Are you sure you wish to remove the role "${role?.name || ''}"?`}
                isDanger
                onConfirm={handleDelete}
              >
                {({ onClick }) => (
                  <Button type="DANGER" onClick={onClick} isDisabled={isLoading}>
                    Delete
                  </Button>
                )}
              </Confirm>
            )}
          </Card.Section>
        </Card.Root>
      )}
    </div>
  );
}
