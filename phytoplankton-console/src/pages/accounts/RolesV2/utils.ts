import { StaticPermissionsNode } from '@/apis/models/StaticPermissionsNode';
import { DynamicPermissionsNode } from '@/apis/models/DynamicPermissionsNode';
import { PermissionStatements } from '@/apis/models/PermissionStatements';
import { PermissionsAction } from '@/apis/models/PermissionsAction';
import { getOr } from '@/utils/asyncResource';

export type PermissionNode = StaticPermissionsNode | DynamicPermissionsNode;

export type PermissionPath = {
  segments: string[];
  full: string;
};

/**
 * Generic permission path builder
 * Works with any path structure and tenant format
 */
export class PermissionPathBuilder {
  private pathSeparator: string;
  private resourcePrefix: string;
  private wildcardTemplate: string;

  constructor(
    tenantName: string,
    pathSeparator: string = '/',
    resourceTemplate: string = 'frn:console:{tenant}:::{path}',
    wildcardTemplate: string = '{resource}/*',
  ) {
    this.pathSeparator = pathSeparator;
    this.resourcePrefix = resourceTemplate.replace('{tenant}', tenantName);
    this.wildcardTemplate = wildcardTemplate;
  }

  /**
   * Build a permission path from segments
   */
  buildPath(segments: string[]): PermissionPath {
    const full = segments.join(this.pathSeparator);
    return { segments, full };
  }

  /**
   * Convert path to resource string
   */
  pathToResource(path: PermissionPath): string {
    return this.resourcePrefix.replace('{path}', path.full);
  }

  /**
   * Convert path to wildcard resource
   */
  pathToWildcardResource(path: PermissionPath): string {
    const resource = this.pathToResource(path);
    return this.wildcardTemplate.replace('{resource}', resource);
  }

  /**
   * Extract path from resource string
   */
  resourceToPath(resource: string): PermissionPath | null {
    const match = resource.match(/^frn:console:(?:[^:]+):::(.*)$/);
    if (!match) {
      return null;
    }

    const pathStr = match[1].replace(/\/\*$/, '');
    const segments = pathStr.split(this.pathSeparator).filter(Boolean);
    return this.buildPath(segments);
  }

  /**
   * Create resource path from permission path string
   */
  createResourcePath(permPath: string): string {
    return this.resourcePrefix.replace('{path}', permPath);
  }

  /**
   * Create wildcard resource path
   */
  createWildcardPath(resource: string): string {
    return this.wildcardTemplate.replace('{resource}', resource);
  }
}

/**
 * Generic resource matcher
 * Works with any resource pattern format
 */
export const matchesResource = (targetPath: string, resourcePattern: string): boolean => {
  const resourcePathMatch = resourcePattern.match(/^frn:console:(?:[^:]+):::(.*)$/);
  const resourcePath = resourcePathMatch ? resourcePathMatch[1] : resourcePattern;

  if (resourcePath === '*') {
    return true;
  }

  if (resourcePath === targetPath) {
    return true;
  }

  if (resourcePath.endsWith('/*')) {
    const basePath = resourcePath.slice(0, -2);
    return targetPath === basePath || targetPath.startsWith(`${basePath}/`);
  }

  return false;
};

/**
 * Generic permission tree traversal utilities
 */
export class PermissionTreeTraverser {
  private pathBuilder: PermissionPathBuilder;

  constructor(pathBuilder: PermissionPathBuilder) {
    this.pathBuilder = pathBuilder;
  }

  private isDynamicNode(node: PermissionNode): node is DynamicPermissionsNode {
    return node.type === 'DYNAMIC';
  }

  /**
   * Generate path for any permission node
   */
  getNodePath(node: PermissionNode, parentSegments: string[] = []): PermissionPath {
    const nodeSegment = this.getNodeSegment(node);
    const segments = [...parentSegments, nodeSegment];
    return this.pathBuilder.buildPath(segments);
  }

  /**
   * Get the path segment for a node
   */
  private getNodeSegment(node: PermissionNode): string {
    if (this.isDynamicNode(node)) {
      return node.subType ? `${node.id}/${node.subType}` : node.id;
    }
    return node.id;
  }

  /**
   * Flatten permission tree into actionable nodes
   */
  flattenNodes(nodes: PermissionNode[]): PermissionNode[] {
    const flattened: PermissionNode[] = [];

    const processNode = (node: PermissionNode) => {
      if (this.isDynamicNode(node) && node.items?.length) {
        // Convert dynamic items to static nodes
        const staticItems: StaticPermissionsNode[] = node.items.map((item) => ({
          id: `${node.id}:${item.id}`,
          name: item.name,
          type: 'STATIC' as const,
          actions: node.actions || [],
        }));
        flattened.push(...staticItems);
      } else {
        flattened.push(node);
      }
    };

    nodes.forEach(processNode);
    return flattened;
  }

  /**
   * Get all child nodes
   */
  getChildNodes(node: PermissionNode): PermissionNode[] {
    if (this.isDynamicNode(node) && node.items?.length) {
      return node.items.map(
        (item): StaticPermissionsNode => ({
          id: `${node.id}:${item.id}`,
          name: item.name,
          type: 'STATIC' as const,
          actions: node.actions || [],
        }),
      );
    }

    if (node.children?.length) {
      return this.flattenNodes(node.children);
    }

    return [];
  }

  /**
   * Count permissions recursively for any tree structure
   */
  countNodePermissions(
    node: PermissionNode,
    statements: PermissionStatements[],
    parentSegments: string[] = [],
  ): Record<PermissionsAction, number> {
    const counts: Record<string, number> = {};
    const availableActions = node.actions || [];

    availableActions.forEach((action) => {
      counts[action] = 0;
    });

    const traverseNode = (currentNode: PermissionNode, currentSegments: string[]) => {
      const nodePath = this.getNodePath(currentNode, currentSegments);
      availableActions.forEach((action) => {
        const hasPermission = statements.some(
          (stmt) =>
            stmt.actions.includes(action) &&
            stmt.resources.some((res) => matchesResource(nodePath.full, res)),
        );

        if (hasPermission) {
          counts[action]++;
        }
      });

      const children = this.getChildNodes(currentNode);
      children.forEach((child) => {
        const childCounts = this.countNodePermissions(child, statements, nodePath.segments);
        availableActions.forEach((action) => {
          counts[action] += childCounts[action] || 0;
        });
      });
    };

    traverseNode(node, parentSegments);
    return counts as Record<PermissionsAction, number>;
  }
}

/**
 * Generic permission checker
 */
export class PermissionChecker {
  private pathBuilder: PermissionPathBuilder;
  private traverser: PermissionTreeTraverser;

  constructor(tenantName: string) {
    this.pathBuilder = new PermissionPathBuilder(tenantName);
    this.traverser = new PermissionTreeTraverser(this.pathBuilder);
  }

  hasPermission(
    node: PermissionNode,
    action: PermissionsAction,
    statements: PermissionStatements[],
    parentSegments: string[] = [],
  ): boolean {
    const nodePath = this.traverser.getNodePath(node, parentSegments);

    return statements.some(
      (stmt) =>
        stmt.actions.includes(action) &&
        stmt.resources.some((resource) => matchesResource(nodePath.full, resource)),
    );
  }

  /**
   * Get all permissions for a node
   */
  getNodePermissions(
    node: PermissionNode,
    statements: PermissionStatements[],
    parentSegments: string[] = [],
  ): Record<string, boolean> {
    const permissions: Record<string, boolean> = {};
    const availableActions = node.actions || [];

    availableActions.forEach((action) => {
      permissions[action] = this.hasPermission(node, action, statements, parentSegments);
    });

    return permissions;
  }
}

/**
 * Generic permission statement manager
 * Handles adding, removing, and optimizing permission statements
 */
export class PermissionStatementManager {
  private pathBuilder: PermissionPathBuilder;
  private parentWildcardRegex: RegExp;

  constructor(tenantName: string) {
    this.pathBuilder = new PermissionPathBuilder(tenantName);
    this.parentWildcardRegex = /^frn:console:(?:[^:]+):::(.+)\/\*$/;
  }

  /**
   * Find existing statement that contains a resource
   */
  private findExistingResourceStatement(
    statements: PermissionStatements[],
    resource: string,
    resourceWildcard: string,
  ): { index: number; statement: PermissionStatements } | null {
    const index = statements.findIndex((stmt) =>
      stmt.resources.some((res) => res === resource || res === resourceWildcard),
    );
    return index >= 0 ? { index, statement: statements[index] } : null;
  }

  /**
   * Add permission to statements (generic for any action type)
   */
  addPermission(
    permPath: string,
    action: PermissionsAction,
    statements: PermissionStatements[],
  ): PermissionStatements[] {
    const resource = this.pathBuilder.createResourcePath(permPath);
    const resourceWildcard = this.pathBuilder.createWildcardPath(resource);
    const newStatements = [...statements];

    const existingStmt = this.findExistingResourceStatement(statements, resource, resourceWildcard);

    if (existingStmt) {
      let handled = false;

      for (let i = 0; i < newStatements.length; i++) {
        const stmt = newStatements[i];
        if (stmt.resources.some((res) => res === resource || res === resourceWildcard)) {
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

      if (!handled) {
        newStatements.push({
          actions: [action],
          resources: [resourceWildcard],
        });
      }
    } else {
      newStatements.push({
        actions: [action],
        resources: [resourceWildcard],
      });
    }

    return newStatements;
  }

  /**
   * Remove permission from statements
   */
  removePermission(
    permPath: string,
    action: PermissionsAction,
    statements: PermissionStatements[],
    permissionsData?: any,
  ): PermissionStatements[] {
    const resource = this.pathBuilder.createResourcePath(permPath);
    const resourceWildcard = this.pathBuilder.createWildcardPath(resource);
    let newStatements = [...statements];

    newStatements = this.removeResourceFromStatements(
      newStatements,
      resource,
      resourceWildcard,
      action,
    );

    const parentWildcard = this.isPermissionCoveredByWildcard(permPath, statements, action);

    if (parentWildcard) {
      newStatements = this.removeParentWildcard(
        newStatements,
        parentWildcard,
        action,
        permPath,
        permissionsData,
      );
    }

    return newStatements;
  }

  /**
   * Check if permission is covered by wildcard
   */
  private isPermissionCoveredByWildcard(
    permPath: string,
    statements: PermissionStatements[],
    action: PermissionsAction,
  ): string | null {
    const pathSegments = permPath.split('/').filter(Boolean);

    for (let i = pathSegments.length - 1; i > 0; i--) {
      const parentPathSegments = pathSegments.slice(0, i);
      const parentPath = this.pathBuilder.buildPath(parentPathSegments);
      const parentWildcard = this.pathBuilder.pathToWildcardResource(parentPath);

      const matchingStatement = statements.find(
        (stmt) => stmt.actions.includes(action) && stmt.resources.includes(parentWildcard),
      );

      if (matchingStatement) {
        return parentWildcard;
      }
    }

    return null;
  }

  /**
   * Remove parent wildcard and handle siblings
   */
  private removeParentWildcard(
    statements: PermissionStatements[],
    parentWildcard: string,
    action: PermissionsAction,
    permPath: string,
    permissionsData?: any,
  ): PermissionStatements[] {
    const newStatements = [...statements];
    const parentWildcardStatementIndex = newStatements.findIndex(
      (stmt) =>
        stmt.resources.some((res) => res === parentWildcard) && stmt.actions.includes(action),
    );

    if (parentWildcardStatementIndex < 0) {
      return newStatements;
    }

    const parentStmt = newStatements[parentWildcardStatementIndex];

    if (parentStmt.actions.length === 1) {
      newStatements[parentWildcardStatementIndex] = {
        ...parentStmt,
        resources: parentStmt.resources.filter((res) => res !== parentWildcard),
      };

      if (newStatements[parentWildcardStatementIndex].resources.length === 0) {
        newStatements.splice(parentWildcardStatementIndex, 1);
      }
    } else {
      newStatements[parentWildcardStatementIndex] = {
        ...parentStmt,
        actions: parentStmt.actions.filter((a) => a !== action),
      };
    }

    // Handle sibling permissions if needed
    if (permissionsData) {
      return this.handleSiblingPermissions(
        newStatements,
        parentWildcard,
        permPath,
        action,
        permissionsData,
      );
    }

    return newStatements;
  }

  /**
   * Remove specific resource from statements
   */
  private removeResourceFromStatements(
    statements: PermissionStatements[],
    resource: string,
    resourceWildcard: string,
    action: PermissionsAction,
  ): PermissionStatements[] {
    const newStatements = [...statements];

    for (let i = 0; i < newStatements.length; i++) {
      const stmt = newStatements[i];

      const affectsResource = stmt.resources.some((res) => {
        return res === resource || res === resourceWildcard;
      });

      if (affectsResource && stmt.actions.includes(action)) {
        const updatedActions = stmt.actions.filter((a) => a !== action);

        if (updatedActions.length === 0) {
          if (stmt.resources.length === 1) {
            newStatements.splice(i, 1);
            i--;
          } else {
            newStatements[i] = {
              ...stmt,
              resources: stmt.resources.filter((res) => {
                return res !== resource && res !== resourceWildcard;
              }),
            };
          }
        } else {
          newStatements[i] = {
            ...stmt,
            actions: updatedActions,
          };
        }
      }
    }

    return newStatements;
  }

  /**
   * Handle sibling permissions when removing wildcards
   */
  private handleSiblingPermissions(
    statements: PermissionStatements[],
    parentWildcard: string,
    permPath: string,
    action: PermissionsAction,
    permissionsData: any,
  ): PermissionStatements[] {
    const newStatements = [...statements];
    const parentPathMatch = parentWildcard.match(this.parentWildcardRegex);

    if (!parentPathMatch || !parentPathMatch[1]) {
      return newStatements;
    }

    const parentPath = parentPathMatch[1];

    const treeSiblingPaths = getAllPathsCoveredByParent(parentPath, permissionsData, permPath);

    // Also check for any existing individual permissions that might be covered
    const existingSiblingPaths: string[] = [];
    statements.forEach((stmt) => {
      if (stmt.actions.includes(action)) {
        stmt.resources.forEach((resource) => {
          const pathMatch = resource.match(/^frn:console:[^:]+:::(.+)$/);
          if (pathMatch) {
            const resourcePath = pathMatch[1];
            // Check if this permission is covered by the parent wildcard being removed
            if (resourcePath.startsWith(parentPath + '/') && resourcePath !== permPath) {
              existingSiblingPaths.push(resourcePath);
            }
          }
        });
      }
    });

    const allSiblingPaths = [...new Set([...treeSiblingPaths, ...existingSiblingPaths])];

    if (allSiblingPaths.length > 0) {
      const siblingResources = allSiblingPaths.map((path) => {
        const resource = this.pathBuilder.createResourcePath(path);
        return this.pathBuilder.createWildcardPath(resource);
      });

      newStatements.push({
        actions: [action],
        resources: siblingResources,
      });
    }

    return newStatements;
  }

  /**
   * Optimize permission statements by grouping and removing redundancy
   */
  optimizeStatements(
    statements: PermissionStatements[],
    permissionTreeData?: any,
  ): PermissionStatements[] {
    if (!statements || !Array.isArray(statements) || statements.length === 0) {
      return [];
    }

    const flattenedPairs: { resource: string; actions: PermissionsAction[] }[] = [];

    statements.forEach((stmt) => {
      if (!stmt.resources || !Array.isArray(stmt.resources) || stmt.resources.length === 0) {
        return;
      }

      stmt.resources.forEach((resource) => {
        flattenedPairs.push({
          resource,
          actions: [...stmt.actions],
        });
      });
    });

    // Group resources by action sets
    const actionGroups: { [actionKey: string]: string[] } = {};

    flattenedPairs.forEach((pair) => {
      const actionKey = [...pair.actions].sort().join(',');
      if (!actionGroups[actionKey]) {
        actionGroups[actionKey] = [];
      }
      actionGroups[actionKey].push(pair.resource);
    });

    // Remove redundant resources covered by parent wildcards
    Object.keys(actionGroups).forEach((actionKey) => {
      const resources = actionGroups[actionKey];
      const optimizedResources: string[] = [];

      resources.forEach((resource) => {
        const isCoveredByParent = resources.some((otherResource) => {
          if (resource === otherResource) {
            return false;
          }

          const resourcePath = resource.split(':::')[1];
          const otherResourcePath = otherResource.split(':::')[1];

          if (!resourcePath || !otherResourcePath) {
            return false;
          }

          if (otherResourcePath.endsWith('/*')) {
            const parentPath = otherResourcePath.slice(0, -2);

            if (resourcePath.startsWith(parentPath + '/')) {
              return true;
            }

            if (permissionTreeData) {
              return this.isChildOfParentInTree(resourcePath, parentPath, permissionTreeData);
            }
          }

          return false;
        });

        if (!isCoveredByParent) {
          optimizedResources.push(resource);
        }
      });

      actionGroups[actionKey] = optimizedResources;
    });

    const optimizedStatements: PermissionStatements[] = [];

    Object.entries(actionGroups).forEach(([actionKey, resources]) => {
      const actions = actionKey.split(',').filter((a) => a) as PermissionsAction[];

      if (actions.length === 0) {
        return;
      }

      optimizedStatements.push({
        actions,
        resources: Array.from(new Set(resources)),
      });
    });

    return optimizedStatements;
  }

  private isChildOfParentInTree(
    childPath: string,
    parentPath: string,
    permissionTreeData: any,
  ): boolean {
    if (!permissionTreeData?.permissions) {
      return false;
    }

    const parentSegments = parentPath.split('/');

    // Navigate to the parent node in the tree
    const currentNode = this.findNodeInTree(parentSegments, permissionTreeData.permissions);
    if (!currentNode) {
      return false;
    }

    // Check if this parent has dynamic items
    if (currentNode.type === 'DYNAMIC' && currentNode.items?.length) {
      return currentNode.items.some((item: any) => {
        const expectedChildPath = parentSegments
          .slice(0, -1)
          .concat([`${currentNode.id}:${item.id}`])
          .join('/');
        return childPath === expectedChildPath;
      });
    }

    return false;
  }

  private findNodeInTree(segments: string[], nodes: any[]): any | null {
    if (!segments.length || !nodes?.length) {
      return null;
    }

    const [firstSegment, ...remainingSegments] = segments;

    for (const node of nodes) {
      if (node.id === firstSegment) {
        if (remainingSegments.length === 0) {
          return node;
        }
        return this.findNodeInTree(remainingSegments, node.children || []);
      }
    }

    return null;
  }
}

export const validateRoleName = (name: string): { isValid: boolean; error?: string } => {
  if (!name.trim()) {
    return { isValid: false, error: 'Role name cannot be empty.' };
  }

  if (name.includes(':')) {
    return { isValid: false, error: 'Character : is not allowed in role name' };
  }

  if (name.includes('-')) {
    return { isValid: false, error: 'Character - is not allowed in role name' };
  }

  if (name.length > 64) {
    return { isValid: false, error: 'Role name must be 64 characters or less' };
  }

  if (!/^[a-zA-Z0-9_\s]+$/.test(name)) {
    return {
      isValid: false,
      error: 'Role name can only contain letters, numbers, underscores, and spaces',
    };
  }

  return { isValid: true };
};

export const isPermissionCoveredByWildcard = (
  permPath: string,
  statements: PermissionStatements[],
  action: PermissionsAction,
  tenantName: string,
): string | null => {
  const manager = new PermissionStatementManager(tenantName);
  return manager['isPermissionCoveredByWildcard'](permPath, statements, action);
};

const getAllPathsCoveredByParent = (
  parentPath: string,
  permissionsResponse: any,
  excludePath: string,
): string[] => {
  const allCoveredPaths: string[] = [];
  const permissionsData = getOr(permissionsResponse, { permissions: [] }).permissions;

  if (!permissionsData || permissionsData.length === 0) {
    return [];
  }

  const findPaths = (nodes: any[], currentPath = ''): string[] => {
    const paths: string[] = [];

    nodes?.forEach((node) => {
      if (!node) {
        return;
      }

      if (node.type === 'DYNAMIC') {
        if (node.items?.length) {
          node.items.forEach((item: any) => {
            const itemPath = currentPath
              ? `${currentPath}/${node.id}:${item.id}`
              : `${node.id}:${item.id}`;
            paths.push(itemPath);
          });
        }

        if (node.children?.length) {
          paths.push(...findPaths(node.children, currentPath));
        }
      } else {
        const nodeId = node.id;
        const fullPath = currentPath ? `${currentPath}/${nodeId}` : nodeId;
        paths.push(fullPath);

        if (node.children?.length) {
          paths.push(...findPaths(node.children, fullPath));
        }
      }
    });

    return paths;
  };

  const allPaths = findPaths(permissionsData);

  // Find all paths that start with the parent path
  // BUT exclude any paths that are parents of the excluded path
  allPaths.forEach((path) => {
    const isUnderParent = path.startsWith(parentPath + '/');
    const isExcludedPath = path === excludePath;
    const isParentOfExcluded = excludePath.startsWith(path + '/');

    if (isUnderParent && !isExcludedPath && !isParentOfExcluded) {
      allCoveredPaths.push(path);
    }
  });

  return allCoveredPaths;
};
