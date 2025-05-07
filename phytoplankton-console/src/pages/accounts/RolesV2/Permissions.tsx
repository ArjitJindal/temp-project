import { useMemo, useState, useCallback, useEffect } from 'react';
import { DownOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import SubPermissions from './SubPermissions';
import s from './style.module.less';
import { doesResourceMatch } from './utils';
import {
  AccountRole,
  PermissionsResponse,
  StaticPermissionsNode,
  DynamicPermissionsNode,
  Permission,
} from '@/apis';
import Button from '@/components/library/Button';
import Form from '@/components/library/Form';
import TextInput from '@/components/library/TextInput';
import InputField from '@/components/library/Form/InputField';

type PermissionNode = StaticPermissionsNode | DynamicPermissionsNode;

interface SearchFormValues {
  query: string;
}

const Permissions = ({
  role,
  permissions,
  mode,
  onPermissionChange,
  onQueryChange,
  query,
}: {
  role?: AccountRole | any;
  permissions: PermissionsResponse;
  mode: 'view' | 'edit';
  onPermissionChange: (permission: Permission, action: 'read' | 'write', checked: boolean) => void;
  onQueryChange: (query: string) => void;
  query: string;
}) => {
  const [searchQuery, setSearchQuery] = useState(query);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  }, []);

  const isDynamicPermission = useCallback(
    (permission: PermissionNode | null): permission is DynamicPermissionsNode => {
      return permission?.type === 'DYNAMIC';
    },
    [],
  );

  const permissionNodes = useMemo(() => {
    const nodes = permissions.permissions || [];
    const processedNodes: PermissionNode[] = [];

    nodes.forEach((node) => {
      if (isDynamicPermission(node) && node.items?.length) {
        const items = node.items.map((item) => ({
          id: item.id,
          name: item.name,
          type: 'STATIC' as const,
          actions: node.actions,
        }));
        processedNodes.push(...items);
      } else {
        processedNodes.push(node);
      }
    });

    return processedNodes;
  }, [permissions.permissions, isDynamicPermission]);

  const countGrantedPermissions = useCallback(
    (node: PermissionNode) => {
      let readCount = 0;
      let writeCount = 0;

      const countPermissionsRecursively = (currentNode: PermissionNode, path: string) => {
        const nodePath = path ? `${path}/${currentNode.id}` : currentNode.id;

        if (isDynamicPermission(currentNode) && currentNode.items?.length) {
          currentNode.items.forEach((item) => {
            const itemPath = `${nodePath}/${item.id}`;

            if (
              currentNode.actions?.includes('read') &&
              role?.statements?.some(
                (statement) =>
                  statement.actions.includes('read') &&
                  statement.resources.some((resource) => doesResourceMatch(itemPath, resource)),
              )
            ) {
              readCount++;
            }

            if (
              currentNode.actions?.includes('write') &&
              role?.statements?.some(
                (statement) =>
                  statement.actions.includes('write') &&
                  statement.resources.some((resource) => doesResourceMatch(itemPath, resource)),
              )
            ) {
              writeCount++;
            }
          });
        } else {
          if (
            currentNode.actions?.includes('read') &&
            role?.statements?.some(
              (statement) =>
                statement.actions.includes('read') &&
                statement.resources.some((resource) => doesResourceMatch(nodePath, resource)),
            )
          ) {
            readCount++;
          }

          if (
            currentNode.actions?.includes('write') &&
            role?.statements?.some(
              (statement) =>
                statement.actions.includes('write') &&
                statement.resources.some((resource) => doesResourceMatch(nodePath, resource)),
            )
          ) {
            writeCount++;
          }
        }

        if (currentNode.children && currentNode.children.length > 0) {
          currentNode.children.forEach((child) => {
            countPermissionsRecursively(child, nodePath);
          });
        }
      };

      countPermissionsRecursively(node, '');
      return { readCount, writeCount };
    },
    [role, isDynamicPermission],
  );

  const permissionCounts = useMemo(() => {
    const counts: Record<string, { readCount: number; writeCount: number }> = {};
    permissionNodes.forEach((node) => {
      counts[node.id] = countGrantedPermissions(node);
    });
    return counts;
  }, [permissionNodes, countGrantedPermissions]);

  const areAllNodesExpanded = useMemo(() => {
    if (permissionNodes.length === 0) {
      return false;
    }

    return permissionNodes.every((node) => expandedNodes[node.id] === true);
  }, [expandedNodes, permissionNodes]);

  const toggleAllExpanded = useCallback(() => {
    const newExpandedState = !areAllNodesExpanded;
    const newExpandedNodes: Record<string, boolean> = {};

    permissionNodes.forEach((node) => {
      newExpandedNodes[node.id] = newExpandedState;
    });

    setExpandedNodes(newExpandedNodes);
  }, [areAllNodesExpanded, permissionNodes]);

  const renderPermissionNode = useCallback(
    (node: PermissionNode) => {
      const nodeId = node.id;
      const isExpanded = expandedNodes[nodeId];

      const { readCount, writeCount } = permissionCounts[nodeId];

      return (
        <div key={nodeId} className={s.permissionNodeContainer}>
          <div className={s.permissionRow}>
            <div className={s.permissionFeature} onClick={() => toggleExpand(nodeId)}>
              <span className={s.expandIcon}>
                {isExpanded ? <DownOutlined /> : <RightOutlined />}
              </span>
              <span>{'name' in node ? node.name : ''}</span>
            </div>
            <div className={s.permissionDetails}>
              <div className={s.permissionAction}>
                <span>{readCount} read</span>
              </div>
              <div className={s.permissionAction}>
                <span>{writeCount} write</span>
              </div>
            </div>
          </div>

          {isExpanded && (
            <div className={s.subPermissionsContainer}>
              <SubPermissions
                subPermissions={node.children || []}
                mode={mode}
                role={role}
                parentPath={nodeId}
                onPermissionChange={onPermissionChange}
              />
            </div>
          )}
        </div>
      );
    },
    [expandedNodes, permissionCounts, mode, role, onPermissionChange, toggleExpand],
  );

  return (
    <div className={s.permissionsContainer}>
      <Form
        className={s.searchBar}
        initialValues={{ query: searchQuery }}
        onSubmit={() => onQueryChange(searchQuery)}
      >
        <InputField<SearchFormValues, 'query'> name="query" label="" hideLabel>
          {(inputProps) => (
            <TextInput
              {...inputProps}
              placeholder="Search for a feature name to set permissions"
              value={searchQuery}
              allowClear
              onChange={(value) => setSearchQuery(value || '')}
              onEnterKey={() => onQueryChange(searchQuery)}
              icon={<SearchOutlined />}
            />
          )}
        </InputField>
        <Button className={s.searchButton} type="PRIMARY" htmlType="submit">
          Search
        </Button>
      </Form>

      <div className={s.permissionsHeader}>
        <div className={s.permissionFeature} onClick={toggleAllExpanded}>
          <span className={s.expandIcon}>
            {areAllNodesExpanded ? <DownOutlined /> : <RightOutlined />}
          </span>
          <div className={s.featureHeader}>Feature</div>
        </div>
        <div className={s.detailsHeader}>Details</div>
      </div>

      <div className={s.permissionsList}>{permissionNodes.map(renderPermissionNode)}</div>
    </div>
  );
};

export default Permissions;
