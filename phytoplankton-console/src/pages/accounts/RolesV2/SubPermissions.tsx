import { useEffect, useState, useCallback, useMemo } from 'react';
import cn from 'clsx';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import s from './style.module.less';
import { doesResourceMatch } from './utils';
import { StaticPermissionsNode } from '@/apis/models/StaticPermissionsNode';
import { DynamicPermissionsNode } from '@/apis/models/DynamicPermissionsNode';
import Checkbox from '@/components/library/Checkbox';
import { AccountRole, Permission } from '@/apis';

type PermissionNode = StaticPermissionsNode | DynamicPermissionsNode;
type Action = 'read' | 'write';

interface SubPermissionsProps {
  subPermissions: PermissionNode[];
  mode: 'view' | 'edit';
  role?: AccountRole;
  onPermissionChange?: (permission: Permission, action: Action, value: boolean) => void;
  parentPath?: string;
}

const SubPermissions = ({
  subPermissions,
  mode,
  role,
  onPermissionChange,
  parentPath = '',
}: SubPermissionsProps) => {
  const [selectedSubPermission, setSelectedSubPermission] = useState<PermissionNode | null>(null);

  useEffect(() => {
    setSelectedSubPermission(null);
  }, [parentPath]);

  const isDynamicPermission = useCallback(
    (permission: PermissionNode | null): permission is DynamicPermissionsNode => {
      return permission?.type === 'DYNAMIC';
    },
    [],
  );

  const getPermissionPath = useCallback(
    (p: PermissionNode): string => {
      const currentSegment = isDynamicPermission(p) ? `${p.id}/${p.subType}` : p.id;
      const result = parentPath ? `${parentPath}/${currentSegment}` : currentSegment;
      return result;
    },
    [parentPath, isDynamicPermission],
  );

  const getChildPermissions = useCallback(
    (permission: PermissionNode): PermissionNode[] => {
      if (isDynamicPermission(permission)) {
        return (
          permission.items?.map(
            (item) =>
              ({
                id: item.id,
                name: item.name,
                type: 'STATIC',
                actions: permission.actions,
              } as StaticPermissionsNode),
          ) ?? []
        );
      }

      const children = permission.children ?? [];
      const flattenedChildren: PermissionNode[] = [];

      children.forEach((child) => {
        if (isDynamicPermission(child) && child.items?.length) {
          const dynamicItems = child.items.map((item) => ({
            id: item.id,
            name: item.name,
            type: 'STATIC' as const,
            actions: child.actions,
          }));
          flattenedChildren.push(...dynamicItems);
        } else {
          flattenedChildren.push(child);
        }
      });

      return flattenedChildren.filter((child) => {
        return !isDynamicPermission(child) || !!child.items?.length;
      });
    },
    [isDynamicPermission],
  );

  const permissionMap = useMemo(() => {
    if (!role?.statements) {
      return new Map<string, { read: boolean; write: boolean }>();
    }

    const map = new Map<string, { read: boolean; write: boolean }>();
    const statements = role.statements;

    subPermissions.forEach((permission) => {
      const permPath = getPermissionPath(permission);
      const nodeActions = permission.actions ?? [];

      const hasRead =
        nodeActions.includes('read') &&
        statements.some(
          (statement) =>
            statement.actions.includes('read') &&
            statement.resources.some((resource) => doesResourceMatch(permPath, resource)),
        );

      const hasWrite =
        nodeActions.includes('write') &&
        statements.some(
          (statement) =>
            statement.actions.includes('write') &&
            statement.resources.some((resource) => doesResourceMatch(permPath, resource)),
        );

      map.set(permPath, { read: hasRead, write: hasWrite });
    });

    return map;
  }, [subPermissions, role, getPermissionPath]);

  const hasPermission = useCallback(
    (permission: PermissionNode, action: Action): boolean => {
      const permPath = getPermissionPath(permission);
      const permissions = permissionMap.get(permPath);

      if (!permissions) {
        return false;
      }

      return action === 'read' ? permissions.read : permissions.write;
    },
    [permissionMap, getPermissionPath],
  );

  const handlePermissionChange = useCallback(
    (permission: PermissionNode, action: Action, checked: boolean) => {
      if (!onPermissionChange) {
        return;
      }
      const permissionString = `${getPermissionPath(permission)}:${action}` as Permission;

      if (action === 'read' && !checked) {
        if (hasPermission(permission, 'write')) {
          const writePermissionString = `${getPermissionPath(permission)}:write` as Permission;
          onPermissionChange(writePermissionString, 'write', false);
        }
      }

      onPermissionChange(permissionString, action, checked);
    },
    [onPermissionChange, getPermissionPath, hasPermission],
  );

  const renderRecursiveSubPermissions = useCallback(
    (selectedPerm: PermissionNode) => {
      const children = getChildPermissions(selectedPerm);
      if (!children.length) {
        return null;
      }

      const currentFullPath = getPermissionPath(selectedPerm);

      return (
        <SubPermissions
          subPermissions={children}
          mode={mode}
          role={role}
          onPermissionChange={onPermissionChange}
          parentPath={currentFullPath}
        />
      );
    },
    [getChildPermissions, mode, role, onPermissionChange, getPermissionPath],
  );

  const processedPermissions = useMemo(() => {
    const processed: PermissionNode[] = [];

    subPermissions.forEach((permission) => {
      if (isDynamicPermission(permission) && permission.items?.length) {
        const items = permission.items.map((item) => ({
          id: item.id,
          name: item.name,
          type: 'STATIC' as const,
          actions: permission.actions,
        }));
        processed.push(...items);
      } else {
        processed.push(permission);
      }
    });

    return processed;
  }, [subPermissions, isDynamicPermission]);

  return (
    <div className={s.subPermissionsWrapper}>
      <div className={s.subPermissions}>
        {processedPermissions.map((permission) => {
          const clickable = getChildPermissions(permission).length > 0;
          const hasReadPerm = hasPermission(permission, 'read');
          const hasWritePerm = hasPermission(permission, 'write');
          const permissionName = isDynamicPermission(permission)
            ? permission.subType
            : permission.name;
          const uniqueKey = getPermissionPath(permission);

          return (
            <div
              key={uniqueKey}
              className={cn(s.permissionRow, {
                [s.selected]: selectedSubPermission?.id === permission.id,
              })}
              onClick={() => {
                if (clickable) {
                  setSelectedSubPermission((prev) =>
                    prev?.id === permission.id ? null : permission,
                  );
                }
              }}
            >
              <div className={s.permission} style={{ cursor: clickable ? 'pointer' : 'default' }}>
                {clickable ? (
                  selectedSubPermission?.id === permission.id ? (
                    <DownOutlined size={8} className={s.arrow} />
                  ) : (
                    <RightOutlined size={8} className={s.arrow} />
                  )
                ) : (
                  <div className={s.arrow} />
                )}
                <div>{permissionName}</div>
              </div>
              <div className={s.permissionActions}>
                <div
                  key={`read-${uniqueKey}`}
                  className={cn(s.permissionAction, {
                    [s.hidden]: !permission.actions?.includes('read'),
                  })}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Checkbox
                    value={hasReadPerm}
                    isDisabled={mode === 'view'}
                    onChange={(newValue) => {
                      if (newValue !== undefined) {
                        handlePermissionChange(permission, 'read', newValue);
                      }
                    }}
                  />
                  <div key={`read-label-${uniqueKey}`}>Read</div>
                </div>
                <div
                  key={`write-${uniqueKey}`}
                  className={cn(s.permissionAction, {
                    [s.hidden]: !permission.actions?.includes('write'),
                  })}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  <Checkbox
                    value={hasWritePerm}
                    isDisabled={mode === 'view'}
                    onChange={(newValue) => {
                      if (newValue !== undefined) {
                        handlePermissionChange(permission, 'write', newValue);
                      }
                    }}
                  />
                  <div key={`write-label-${uniqueKey}`}>Write</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {selectedSubPermission && (
        <div className={s.column}>{renderRecursiveSubPermissions(selectedSubPermission)}</div>
      )}
    </div>
  );
};

export default SubPermissions;
