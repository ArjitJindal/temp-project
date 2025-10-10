import { useMemo, useState, useCallback, useEffect } from 'react';
import { DownOutlined, RightOutlined, SearchOutlined } from '@ant-design/icons';
import SubPermissions from './SubPermissions';
import s from './style.module.less';
import { PermissionNode, PermissionTreeTraverser, PermissionPathBuilder } from './utils';
import { AccountRole, PermissionsResponse, PermissionsAction, StaticPermissionsNode } from '@/apis';
import Button from '@/components/library/Button';
import Form from '@/components/library/Form';
import TextInput from '@/components/library/TextInput';
import InputField from '@/components/library/Form/InputField';
import { useAuth0User } from '@/utils/user-utils';

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
  onPermissionChange: (permission: string, action: PermissionsAction, checked: boolean) => void;
  onQueryChange: (query: string) => void;
  query: string;
}) => {
  const [searchQuery, setSearchQuery] = useState(query);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const auth0User = useAuth0User();

  const tenantName = auth0User?.tenantName?.toLowerCase() || '';
  const pathBuilder = useMemo(() => new PermissionPathBuilder(tenantName), [tenantName]);
  const traverser = useMemo(() => new PermissionTreeTraverser(pathBuilder), [pathBuilder]);

  useEffect(() => {
    setSearchQuery(query);
  }, [query]);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  }, []);

  const permissionNodes = useMemo(() => {
    return traverser.flattenNodes(permissions.permissions || []);
  }, [permissions.permissions, traverser]);

  const countGrantedPermissions = useCallback(
    (node: PermissionNode) => {
      if (!role?.statements) {
        return {};
      }

      return traverser.countNodePermissions(node, role.statements);
    },
    [role, traverser],
  );

  const permissionCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = {};
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
      const counts = permissionCounts[nodeId] || {};
      const availableActions = node.actions || [];

      return (
        <div key={nodeId} className={s.permissionNodeContainer}>
          <div className={s.permissionRow}>
            <div className={s.permissionFeature} onClick={() => toggleExpand(nodeId)}>
              <span className={s.expandIcon}>
                {isExpanded ? <DownOutlined /> : <RightOutlined />}
              </span>
              <span>{(node as StaticPermissionsNode).name || ''}</span>
            </div>
            <div className={s.permissionDetails}>
              {availableActions.map((action) => (
                <div key={action} className={s.permissionAction}>
                  <span>
                    {counts[action] || 0} {action}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {isExpanded && (
            <div className={s.subPermissionsContainer}>
              <SubPermissions
                subPermissions={node.children || []}
                mode={mode}
                role={role}
                parentSegments={[nodeId]}
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
