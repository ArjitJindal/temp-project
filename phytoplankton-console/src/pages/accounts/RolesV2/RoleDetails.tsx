import { useCallback, useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { capitalizeNameFromEmail } from '@flagright/lib/utils/humanize';
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
import { AccountRole, CreateAccountRole, PermissionStatements, PermissionsAction } from '@/apis';
import { getErrorMessage } from '@/utils/lang';
import { useAuth0User } from '@/utils/user-utils';
import { useRoles } from '@/utils/api/auth';
import Confirm from '@/components/utils/Confirm';
import { makeUrl } from '@/utils/routing';

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
  const { rolesList, refetch } = useRoles();
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
    (permission: string, action: PermissionsAction, checked: boolean) => {
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

          const optimizedStatements =
            statementManager.optimizeStatementsWithPathSeparation(newStatements);

          return optimizedStatements;
        } else {
          newStatements = statementManager.removePermission(
            permPath,
            action,
            newStatements,
            permissionsQuery.data,
          );

          return newStatements;
        }
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

    const trimmedName = name.trim();
    if (!role?.id && rolesList.some((r) => r.name === trimmedName)) {
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
        const newRole = await api.createRole({ CreateAccountRole: payload as CreateAccountRole });
        message.success('New role created successfully', {
          details: `${capitalizeNameFromEmail(auth0User?.name || '')} created a new role ${
            newRole.name
          }`,
          link: makeUrl(`/accounts/roles/:id/read`, {
            id: newRole.id,
          }),
          linkTitle: 'View role',
          copyFeedback: 'Role URL copied to clipboard',
        });
        queryClient.invalidateQueries(ROLES_LIST());
        handleSuccess?.();
      } else if (role?.id) {
        await api.updateRole({ roleId: role.id, AccountRole: { id: role.id, ...payload } });
        message.success('Role updated successfully', {
          details: `${capitalizeNameFromEmail(auth0User?.name || '')} updated role ${role.name}`,
          link: makeUrl(`/accounts/roles/:id/read`, {
            id: role.id,
          }),
          linkTitle: 'View role',
          copyFeedback: 'Role URL copied to clipboard',
        });
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
  }, [
    name,
    role?.id,
    role?.name,
    rolesList,
    currentStatements,
    description,
    api,
    auth0User?.name,
    queryClient,
    handleSuccess,
  ]);

  const handleDelete = useCallback(async () => {
    if (!role?.id) {
      message.error('Cannot delete role: missing role ID');
      return;
    }

    setIsLoading(true);
    try {
      await api.deleteRole({ roleId: role.id });
      refetch();
      message.success(`Role "${role.name}" has been deleted`);
      navigate('/accounts/roles');
    } catch (error) {
      message.error(`Failed to delete role: ${getErrorMessage(error)}`);
    } finally {
      setIsLoading(false);
    }
  }, [api, role, navigate, refetch]);

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
