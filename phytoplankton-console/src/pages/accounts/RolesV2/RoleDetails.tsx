import { useCallback, useState, useEffect, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import s from './style.module.less';
import Permissions from './Permissions';
import RoleHeader from './RoleHeader';
import { RESOURCE_TEMPLATE, RESOURCE_WILDCARD_TEMPLATE, PARENT_WILDCARD_REGEX } from './constants';
import { isPermissionCoveredByWildcard, getSiblingPermissions, validateRoleName } from './utils';
import * as Card from '@/components/ui/Card';
import Button from '@/components/library/Button';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import { useQuery } from '@/utils/queries/hooks';
import { PERMISSIONS, ROLES_LIST } from '@/utils/queries/keys';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { AccountRole, CreateAccountRole, PermissionStatements, Permission } from '@/apis';
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

  useEffect(() => {
    setName(role?.name || '');
    setDescription(role?.description || '');
    setCurrentStatements(role?.statements || []);
  }, [role]);

  // Creates a resource string from a permission path
  const createResourcePath = useCallback(
    (permPath: string) => {
      return RESOURCE_TEMPLATE.replace(
        '{tenantName}',
        auth0User?.tenantName.toLowerCase() || '',
      ).replace('{permPath}', permPath);
    },
    [auth0User?.tenantName],
  );

  // Creates a wildcard resource path by appending /* to the resource
  const createWildcardPath = useCallback((resource: string) => {
    return RESOURCE_WILDCARD_TEMPLATE.replace('{resource}', resource);
  }, []);

  // Checks if statements already contain a specific resource and action
  const findExistingResourceStatement = useCallback(
    (
      statements: PermissionStatements[],
      resource: string,
      resourceWildcard: string,
    ): { index: number; statement: PermissionStatements } | null => {
      const index = statements.findIndex((stmt) =>
        stmt.resources.some((res) => res === resource || res === resourceWildcard),
      );
      return index >= 0 ? { index, statement: statements[index] } : null;
    },
    [],
  );

  /**
   * Adds a permission (action) to a path in the role's statements
   * This grants the specified permission to the role
   */
  const addPermission = useCallback(
    (permPath: string, action: 'read' | 'write', prevStatements: PermissionStatements[]) => {
      // Create resource paths for the permission
      const resource = createResourcePath(permPath);
      const resourceWildcard = createWildcardPath(resource);
      const newStatements = [...prevStatements];

      // Find existing statements that include this resource
      const existingStmt = findExistingResourceStatement(
        prevStatements,
        resource,
        resourceWildcard,
      );

      if (existingStmt) {
        // Resource exists in statements - check if we need to add the action
        let handled = false;

        for (let i = 0; i < newStatements.length; i++) {
          const stmt = newStatements[i];
          if (stmt.resources.some((res) => res === resource || res === resourceWildcard)) {
            // Add the action if it doesn't already exist
            if (!stmt.actions.includes(action)) {
              newStatements[i] = {
                ...stmt,
                actions: [...stmt.actions, action],
              };
            }
            handled = true;
            break;
          }
        }

        // If we couldn't update an existing statement for some reason, add a new one
        if (!handled) {
          newStatements.push({
            actions: [action],
            resources: [resourceWildcard],
          });
        }
      } else {
        // No existing statement found - add a new one with the wildcard
        newStatements.push({
          actions: [action],
          resources: [resourceWildcard],
        });
      }

      return newStatements;
    },
    [createResourcePath, createWildcardPath, findExistingResourceStatement],
  );

  /**
   * Handles adding sibling permissions when a parent wildcard is removed
   * This prevents losing access to other resources at the same level
   */
  const handleSiblingPermissions = useCallback(
    (
      newStatements: PermissionStatements[],
      parentWildcard: string,
      permPath: string,
      action: 'read' | 'write',
    ): PermissionStatements[] => {
      const permissionsData = permissionsQuery.data;
      if (!permissionsData) {
        return newStatements;
      }

      const parentPathMatch = parentWildcard.match(PARENT_WILDCARD_REGEX);
      if (!parentPathMatch || !parentPathMatch[1]) {
        return newStatements;
      }

      // Get all sibling paths to maintain access to other permissions at same level
      const siblingPaths = getSiblingPermissions(permPath, permissionsData);
      const uniqueSiblingPaths = [...new Set(siblingPaths)];

      if (uniqueSiblingPaths.length > 0) {
        // Convert paths to resource strings
        const siblingResources = uniqueSiblingPaths.map((path) => createResourcePath(path));

        if (siblingResources.length > 0) {
          // Add a new statement with siblings to maintain their access
          newStatements.push({
            actions: [action],
            resources: siblingResources,
          });
        }
      }

      return newStatements;
    },
    [permissionsQuery.data, createResourcePath],
  );

  /**
   * Removes parent wildcard permission and adds sibling permissions
   * This is needed to maintain access to other resources when revoking specific permissions
   */
  const removeParentWildcard = useCallback(
    (
      newStatements: PermissionStatements[],
      parentWildcard: string,
      action: 'read' | 'write',
      permPath: string,
    ): PermissionStatements[] => {
      // Find the statement containing the parent wildcard
      const parentWildcardStatementIndex = newStatements.findIndex(
        (stmt) =>
          stmt.resources.some((res) => res === parentWildcard) && stmt.actions.includes(action),
      );

      if (parentWildcardStatementIndex < 0) {
        return newStatements;
      }

      const parentStmt = newStatements[parentWildcardStatementIndex];

      // If this is the only action, remove the resource; otherwise remove the action
      if (parentStmt.actions.length === 1) {
        newStatements[parentWildcardStatementIndex] = {
          ...parentStmt,
          resources: parentStmt.resources.filter((res) => res !== parentWildcard),
        };

        // Remove the statement entirely if no resources remain
        if (newStatements[parentWildcardStatementIndex].resources.length === 0) {
          newStatements.splice(parentWildcardStatementIndex, 1);
        }
      } else {
        // Multiple actions - just remove this specific action
        newStatements[parentWildcardStatementIndex] = {
          ...parentStmt,
          actions: parentStmt.actions.filter((a) => a !== action),
        };
      }

      // Add back specific permissions for siblings to maintain their access
      return handleSiblingPermissions(newStatements, parentWildcard, permPath, action);
    },
    [handleSiblingPermissions],
  );

  // Processes each statement to remove a specific resource and action
  const removeResourceFromStatements = useCallback(
    (
      newStatements: PermissionStatements[],
      resource: string,
      resourceWildcard: string,
      action: 'read' | 'write',
    ): PermissionStatements[] => {
      for (let i = 0; i < newStatements.length; i++) {
        const stmt = newStatements[i];

        // Check if this statement contains the target resource
        const affectsResource = stmt.resources.some((res) => {
          return res === resource || res === resourceWildcard;
        });

        if (affectsResource && stmt.actions.includes(action)) {
          const updatedActions = stmt.actions.filter((a) => a !== action);

          if (updatedActions.length === 0) {
            // No actions left - either remove the statement or the resource
            if (stmt.resources.length === 1) {
              // Only one resource - remove the statement entirely
              newStatements.splice(i, 1);
              i--;
            } else {
              // Multiple resources - just remove this resource
              newStatements[i] = {
                ...stmt,
                resources: stmt.resources.filter((res) => {
                  return res !== resource && res !== resourceWildcard;
                }),
              };
            }
          } else {
            // Other actions remain - update the statement
            newStatements[i] = {
              ...stmt,
              actions: updatedActions,
            };
          }
        }
      }

      return newStatements;
    },
    [],
  );

  /**
   * Removes a permission (action) from a path in the role's statements
   * This revokes the specified permission from the role
   */
  const removePermission = useCallback(
    (permPath: string, action: 'read' | 'write', prevStatements: PermissionStatements[]) => {
      // Create resource paths for the permission
      const resource = createResourcePath(permPath);
      const resourceWildcard = createWildcardPath(resource);
      const newStatements = [...prevStatements];

      // Check if this permission is covered by a parent wildcard
      const parentWildcard = isPermissionCoveredByWildcard(
        permPath,
        prevStatements,
        action,
        auth0User?.tenantName.toLowerCase() || '',
      );

      // If there's a parent wildcard, we need special handling to maintain other permissions
      if (parentWildcard) {
        return removeParentWildcard(newStatements, parentWildcard, action, permPath);
      }

      // Process each statement to remove this specific resource and action
      return removeResourceFromStatements(newStatements, resource, resourceWildcard, action);
    },
    [
      createResourcePath,
      createWildcardPath,
      auth0User?.tenantName,
      removeParentWildcard,
      removeResourceFromStatements,
    ],
  );

  /**
   * Updates a permission state in the role
   * Handles the write->read dependency (adding write auto-adds read)
   */
  const handlePermissionChange = useCallback(
    (permission: Permission, action: 'read' | 'write', checked: boolean) => {
      if (mode !== 'edit') {
        return;
      }

      setCurrentStatements((prevStatements) => {
        const permPath = permission.split(':')[0];

        if (checked) {
          // When adding a permission
          if (action === 'write') {
            // Write permission implies read permission - add both
            const statementsWithWrite = addPermission(permPath, 'write', prevStatements);
            return addPermission(permPath, 'read', statementsWithWrite);
          } else {
            // Just add read permission
            return addPermission(permPath, action, prevStatements);
          }
        } else {
          // When removing a permission
          return removePermission(permPath, action, prevStatements);
        }
      });
    },
    [mode, addPermission, removePermission],
  );

  /**
   * Optimizes the statements structure by grouping resources with the same actions
   * This reduces redundancy and improves readability of the permission statements
   */
  const optimizeStatements = (statements: PermissionStatements[]): PermissionStatements[] => {
    if (!statements || !Array.isArray(statements) || statements.length === 0) {
      return [];
    }

    // Step 1: Flatten into pairs of resource + actions
    const flattenedPairs: { resource: string; actions: ('read' | 'write')[] }[] = [];

    statements.forEach((stmt) => {
      if (!stmt.resources || !Array.isArray(stmt.resources) || stmt.resources.length === 0) {
        return;
      }

      stmt.resources.forEach((resource) => {
        flattenedPairs.push({
          resource,
          actions: [...stmt.actions] as ('read' | 'write')[],
        });
      });
    });

    // Step 2: Group resources by their action sets
    const actionGroups: { [actionKey: string]: string[] } = {};

    flattenedPairs.forEach((pair) => {
      const actionKey = [...pair.actions].sort().join(',');
      if (!actionGroups[actionKey]) {
        actionGroups[actionKey] = [];
      }
      actionGroups[actionKey].push(pair.resource);
    });

    // Step 3: Convert back to statements structure with grouped resources
    const optimizedStatements: PermissionStatements[] = [];

    Object.entries(actionGroups).forEach(([actionKey, resources]) => {
      const actions = actionKey.split(',').filter((a) => a) as ('read' | 'write')[];

      if (actions.length === 0) {
        return;
      }

      optimizedStatements.push({
        actions,
        resources: [...new Set(resources)],
      });
    });

    return optimizedStatements;
  };

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

    const optimizedStatements = optimizeStatements(currentStatements);

    const payload = {
      name: trimmedName,
      description: description.trim(),
      permissions: [] as Permission[],
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
            <Button type="PRIMARY" onClick={handleSave} isLoading={isLoading}>
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
