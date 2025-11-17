import { useState, useCallback, useMemo, useEffect } from 'react';
import cn from 'clsx';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import s from './style.module.less';
import {
  PermissionNode,
  PermissionChecker,
  PermissionTreeTraverser,
  PermissionPathBuilder,
  isPermissionCoveredByWildcard,
} from './utils';
import Checkbox from '@/components/library/Checkbox';
import { AccountRole, Permission, PermissionsAction, StaticPermissionsNode } from '@/apis';
import { useAuth0User } from '@/utils/user-utils';
import { PERMISSIONS_ACTIONS } from '@/apis/models-custom/PermissionsAction';

interface SubPermissionsProps {
  subPermissions: PermissionNode[];
  mode: 'view' | 'edit';
  role?: AccountRole;
  onPermissionChange?: (permission: string, action: PermissionsAction, value: boolean) => void;
  parentSegments?: string[];
}

const SubPermissions = ({
  subPermissions,
  mode,
  role,
  onPermissionChange,
  parentSegments = [],
}: SubPermissionsProps) => {
  const [selectedSubPermission, setSelectedSubPermission] = useState<PermissionNode | null>(null);
  const auth0User = useAuth0User();

  const tenantName = auth0User?.tenantName?.toLowerCase() || '';
  const checker = useMemo(() => new PermissionChecker(tenantName), [tenantName]);
  const pathBuilder = useMemo(() => new PermissionPathBuilder(tenantName), [tenantName]);
  const traverser = useMemo(() => new PermissionTreeTraverser(pathBuilder), [pathBuilder]);

  const isPermissionChecked = useCallback(
    (
      permission: PermissionNode,
      action: PermissionsAction,
      nodeParentSegments: string[] = [],
    ): boolean => {
      const children = traverser.getChildNodes(permission);
      const hasDirectPerm = checker.hasPermission(
        permission,
        action,
        role?.statements || [],
        nodeParentSegments,
      );

      if (children.length === 0) {
        return hasDirectPerm;
      }

      if (hasDirectPerm) {
        return true;
      }

      const currentPath = traverser.getNodePath(permission, nodeParentSegments);
      const allChildrenChecked = children.every((child) =>
        isPermissionChecked(child, action, currentPath.segments),
      );

      return allChildrenChecked;
    },
    [traverser, checker, role?.statements],
  );

  // Check if node should be visually checked
  const isNodeChecked = useCallback(
    (permission: PermissionNode, action: PermissionsAction): boolean => {
      return isPermissionChecked(permission, action, parentSegments);
    },
    [isPermissionChecked, parentSegments],
  );

  const handlePermissionChange = useCallback(
    (permission: PermissionNode, action: PermissionsAction, checked: boolean) => {
      if (!onPermissionChange) {
        return;
      }

      const nodePath = traverser.getNodePath(permission, parentSegments);
      const permissionString = `${nodePath.full}::::${action}` as Permission;

      if (!checked) {
        const coveredByWildcard = isPermissionCoveredByWildcard(
          nodePath.full,
          role?.statements || [],
          action,
          tenantName,
        );

        if (coveredByWildcard) {
          // This child is covered by a parent wildcard, the removePermission utility
          // will handle the wildcard expansion automatically
        }
      }

      if (action === 'read' && !checked) {
        const availableActions = permission.actions || [];
        if (availableActions.includes('write') && isNodeChecked(permission, 'write')) {
          const writePermissionString = `${nodePath.full}::::write` as Permission;
          onPermissionChange(writePermissionString, 'write', false);
        }
      }

      // Apply permission to current node
      onPermissionChange(permissionString, action, checked);

      const children = traverser.getChildNodes(permission);
      const currentPath = traverser.getNodePath(permission, parentSegments);

      children.forEach((child) => {
        const childPath = traverser.getNodePath(child, currentPath.segments);
        const childPermissionString = `${childPath.full}::::${action}` as Permission;

        onPermissionChange(childPermissionString, action, checked);

        const grandChildren = traverser.getChildNodes(child);
        if (grandChildren.length > 0) {
          const processGrandChildren = (parent: PermissionNode, parentSegs: string[]) => {
            const gChildren = traverser.getChildNodes(parent);
            gChildren.forEach((gChild) => {
              const gChildPath = traverser.getNodePath(gChild, parentSegs);
              const gChildPermissionString = `${gChildPath.full}::::${action}` as Permission;
              onPermissionChange(gChildPermissionString, action, checked);

              if (traverser.getChildNodes(gChild).length > 0) {
                processGrandChildren(gChild, gChildPath.segments);
              }
            });
          };
          processGrandChildren(child, childPath.segments);
        }
      });
    },
    [onPermissionChange, traverser, parentSegments, isNodeChecked, role?.statements, tenantName],
  );

  const renderRecursiveSubPermissions = useCallback(
    (selectedPerm: PermissionNode) => {
      const children = traverser.getChildNodes(selectedPerm);
      if (!children.length) {
        return null;
      }

      const currentPath = traverser.getNodePath(selectedPerm, parentSegments);

      return (
        <SubPermissions
          subPermissions={children}
          mode={mode}
          role={role}
          onPermissionChange={onPermissionChange}
          parentSegments={currentPath.segments}
        />
      );
    },
    [traverser, mode, role, onPermissionChange, parentSegments],
  );

  const processedPermissions = useMemo(() => {
    const filteredPermissions = subPermissions.filter((node) => {
      if (node.type === 'DYNAMIC') {
        return node.items && node.items.length > 0;
      }
      return true;
    });

    return traverser.flattenNodes(filteredPermissions);
  }, [subPermissions, traverser]);

  const parentPath = useMemo(() => parentSegments.join('/'), [parentSegments]);

  useEffect(() => {
    setSelectedSubPermission(null);
  }, [parentPath]);

  return (
    <div className={s.subPermissionsWrapper}>
      <div className={s.subPermissions}>
        {processedPermissions.map((permission) => {
          const children = traverser.getChildNodes(permission);
          const clickable = children.length > 0;
          const availableActions = permission.actions || [];
          const nodePath = traverser.getNodePath(permission, parentSegments);
          const uniqueKey = nodePath.full;

          return (
            <div
              key={uniqueKey}
              className={cn(s.permissionRow, {
                [s.selected]: selectedSubPermission?.id === permission.id,
              })}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
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
                <div>{(permission as StaticPermissionsNode).name || ''}</div>
              </div>
              <div className={s.permissionActions}>
                {PERMISSIONS_ACTIONS.map((action) => {
                  const isAvailable = availableActions.includes(action);

                  const isChecked = isNodeChecked(permission, action);
                  const actionKey = `${action}-${uniqueKey}`;

                  return (
                    <div
                      key={actionKey}
                      className={cn(s.permissionAction, !isAvailable && s.isHidden)}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <Checkbox
                        key={`${actionKey}-${(role?.statements || []).length}`}
                        value={isChecked}
                        isDisabled={mode === 'view'}
                        onChange={(newValue) => {
                          if (newValue !== undefined) {
                            handlePermissionChange(permission, action, newValue);
                          }
                        }}
                      />
                      <div key={`${action}-label-${uniqueKey}`}>{firstLetterUpper(action)}</div>
                    </div>
                  );
                })}
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
