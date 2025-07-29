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
    if (!resource.includes(':::')) {
      return null;
    }

    const pathStr = resource.split(':::')[1].replace(/\/\*$/, '');
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
  const targetPathOnly = targetPath.includes(':::') ? targetPath.split(':::')[1] : targetPath;
  const resourcePath = resourcePattern.includes(':::')
    ? resourcePattern.split(':::')[1]
    : resourcePattern;

  if (resourcePath === '*') {
    return true;
  }

  if (resourcePath === targetPathOnly) {
    return true;
  }

  if (resourcePath.endsWith('/*')) {
    const basePath = resourcePath.slice(0, -2);
    return targetPathOnly === basePath || targetPathOnly.startsWith(`${basePath}/`);
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
      } else if (this.isDynamicNode(node) && (!node.items || node.items.length === 0)) {
        // Skip dynamic nodes with empty items array
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
    if (this.isDynamicNode(node)) {
      if (node.items?.length) {
        return node.items.map(
          (item): StaticPermissionsNode => ({
            id: `${node.id}:${item.id}`,
            name: item.name,
            type: 'STATIC' as const,
            actions: node.actions || [],
          }),
        );
      }
      return []; // Return empty array for dynamic nodes without items
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

    // Check if any statements grant this permission
    const matches = statements.some(
      (stmt) =>
        stmt.actions.includes(action) &&
        stmt.resources.some((resource) => {
          return matchesResource(nodePath.full, resource);
        }),
    );

    return matches;
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

    // Find statement containing the target resource
    let targetStmtIndex = -1;
    let targetResource = '';

    for (let i = 0; i < newStatements.length; i++) {
      const stmt = newStatements[i];

      // Check if this statement contains our target resource
      const matchingResource = stmt.resources.find(
        (res) => res === resource || res === resourceWildcard,
      );

      if (matchingResource) {
        targetStmtIndex = i;
        targetResource = matchingResource;
        break;
      }
    }

    if (targetStmtIndex >= 0) {
      const stmt = newStatements[targetStmtIndex];

      if (stmt.actions.includes(action)) {
        return newStatements;
      }

      // If statement has multiple resources, we need to split it to avoid affecting other resources
      if (stmt.resources.length > 1) {
        // Create a new statement just for our resource with the desired action
        const otherResources = stmt.resources.filter((res) => res !== targetResource);

        // Update original statement to exclude our resource
        newStatements[targetStmtIndex] = {
          ...stmt,
          resources: otherResources,
        };

        // Create new statement for our resource with all existing actions plus the new one
        newStatements.push({
          actions: [...stmt.actions, action],
          resources: [targetResource],
        });
      } else {
        // Statement has only one resource, just add the action
        newStatements[targetStmtIndex] = {
          ...stmt,
          actions: [...stmt.actions, action],
        };
      }
    } else {
      // No existing statement with this resource, create a new one
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

    const resourcePath = resource.includes(':::') ? resource.split(':::')[1] : '';
    const resourceWildcardPath = resourceWildcard.includes(':::')
      ? resourceWildcard.split(':::')[1]
      : '';

    let newStatements = [...statements];

    newStatements = this.removeResourceFromStatements(
      newStatements,
      resource,
      resourceWildcard,
      action,
    );

    if (resourcePath && resourceWildcardPath) {
      for (let i = 0; i < newStatements.length; i++) {
        const stmt = newStatements[i];
        if (!stmt.actions.includes(action)) {
          continue;
        }

        const resourcesToRemove = stmt.resources.filter((res) => {
          const resPath = res.includes(':::') ? res.split(':::')[1] : res;
          return resPath === resourcePath || resPath === resourceWildcardPath;
        });

        if (resourcesToRemove.length > 0) {
          newStatements = this.removeResourceFromStatements(
            newStatements,
            resourcesToRemove[0],
            resourcesToRemove.find((r) => r.endsWith('/*')) || resourcesToRemove[0],
            action,
          );
        }
      }
    }

    const allParentWildcards: string[] = [];

    const pathSegments = permPath.split('/').filter(Boolean);

    for (let i = pathSegments.length - 1; i > 0; i--) {
      const parentPathSegments = pathSegments.slice(0, i);
      const parentPath = this.pathBuilder.buildPath(parentPathSegments);
      const parentWildcardTemplate = this.pathBuilder.pathToWildcardResource(parentPath);

      const wildcardPathOnly = parentWildcardTemplate.includes(':::')
        ? parentWildcardTemplate.split(':::')[1]
        : '';

      for (const stmt of newStatements) {
        if (!stmt.actions.includes(action)) {
          continue;
        }

        for (const res of stmt.resources) {
          const resPathOnly = res.includes(':::') ? res.split(':::')[1] : res;

          if (resPathOnly === wildcardPathOnly) {
            allParentWildcards.push(res);
          }
        }
      }
    }

    if (allParentWildcards.length > 0) {
      allParentWildcards.sort((a, b) => b.length - a.length);
      for (const parentWildcard of allParentWildcards) {
        newStatements = this.removeParentWildcard(
          newStatements,
          parentWildcard,
          action,
          permPath,
          permissionsData,
        );
      }
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

      const templateParentWildcard = this.pathBuilder.pathToWildcardResource(parentPath);

      const wildcardPathOnly = templateParentWildcard.includes(':::')
        ? templateParentWildcard.split(':::')[1]
        : '';

      if (!wildcardPathOnly) {
        continue;
      }

      for (const stmt of statements) {
        if (!stmt.actions.includes(action)) {
          continue;
        }

        for (const resource of stmt.resources) {
          const resourcePathOnly = resource.includes(':::') ? resource.split(':::')[1] : resource;

          if (resourcePathOnly === wildcardPathOnly) {
            return resource;
          }
        }
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

    const parentPathMatch = parentWildcard.includes(':::') ? parentWildcard.split(':::')[1] : '';
    if (!parentPathMatch) {
      return newStatements;
    }

    const tenantPrefix = parentWildcard.split(':::')[0] + ':::';

    const parentStmtIndex = newStatements.findIndex(
      (stmt) =>
        stmt.actions.includes(action) && stmt.resources.some((res) => res === parentWildcard),
    );

    if (parentStmtIndex < 0) {
      return newStatements;
    }

    // Get a copy of the statement containing the wildcard
    const parentStmt = { ...newStatements[parentStmtIndex] };

    let siblingPaths: string[] = [];
    if (permissionsData?.permissions) {
      try {
        const findPaths = (nodes: any[], currentPath = ''): string[] => {
          let paths: string[] = [];

          for (const node of nodes) {
            if (!node) {
              continue;
            }

            const nodeId = node.id;
            const fullPath = currentPath ? `${currentPath}/${nodeId}` : nodeId;

            if (fullPath.startsWith(parentPathMatch + '/') && fullPath !== permPath) {
              paths.push(fullPath);
            }

            if (node.children?.length) {
              paths = [...paths, ...findPaths(node.children, fullPath)];
            }
          }

          return paths;
        };

        siblingPaths = findPaths(permissionsData.permissions, '');
      } catch (error) {
        siblingPaths = [];
      }
    }

    if (siblingPaths.length === 0) {
      siblingPaths = permissionsData
        ? getAllPathsCoveredByParent(parentPathMatch, permissionsData, permPath)
        : [];
    }

    if (siblingPaths.length > 0) {
      const siblingResources = siblingPaths.map((path) => `${tenantPrefix}${path}`);

      newStatements.push({
        actions: [action],
        resources: siblingResources,
      });
    }

    if (parentStmt.resources.length === 1) {
      if (parentStmt.actions.length === 1) {
        newStatements.splice(parentStmtIndex, 1);
      } else {
        newStatements[parentStmtIndex] = {
          ...parentStmt,
          actions: parentStmt.actions.filter((a) => a !== action),
        };
      }
    } else {
      const otherResources = parentStmt.resources.filter((res) => res !== parentWildcard);

      newStatements[parentStmtIndex] = {
        ...parentStmt,
        resources: otherResources,
      };
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
    const parentPathMatch = parentWildcard.includes(':::') ? parentWildcard.split(':::')[1] : '';

    if (!parentPathMatch) {
      return newStatements;
    }

    const treeSiblingPaths = getAllPathsCoveredByParent(parentPathMatch, permissionsData, permPath);

    // Look for existing permissions that might be covered by this parent
    const existingSiblingPaths: string[] = [];
    statements.forEach((stmt) => {
      if (stmt.actions.includes(action)) {
        stmt.resources.forEach((resource) => {
          const pathMatch = resource.includes(':::') ? resource.split(':::')[1] : resource;
          if (pathMatch) {
            const resourcePath = pathMatch.replace(/\/\*$/, ''); // Remove trailing /*
            // Check if this permission is covered by the parent being modified
            if (resourcePath.startsWith(parentPathMatch + '/') && resourcePath !== permPath) {
              existingSiblingPaths.push(resourcePath);
            }
          }
        });
      }
    });

    const allSiblingPaths = [...new Set([...treeSiblingPaths, ...existingSiblingPaths])];

    if (allSiblingPaths.length > 0) {
      // Group siblings by parent path to optimize permissions
      const groupedPaths: Record<string, string[]> = {};

      allSiblingPaths.forEach((path) => {
        const segments = path.split('/');
        if (segments.length > 1) {
          const parentPath = segments.slice(0, -1).join('/');
          if (!groupedPaths[parentPath]) {
            groupedPaths[parentPath] = [];
          }
          groupedPaths[parentPath].push(path);
        } else {
          if (!groupedPaths[path]) {
            groupedPaths[path] = [path];
          }
        }
      });

      // Create optimized statements by grouping similar paths
      Object.entries(groupedPaths).forEach(([, paths]) => {
        if (paths.length > 0) {
          const groupResources = paths.map((path) => {
            const resource = this.pathBuilder.createResourcePath(path);
            return this.pathBuilder.createWildcardPath(resource);
          });

          newStatements.push({
            actions: [action],
            resources: groupResources,
          });
        }
      });
    } else {
      // No siblings found
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

          const resourcePath = resource.includes(':::') ? resource.split(':::')[1] : resource;
          const otherResourcePath = otherResource.includes(':::')
            ? otherResource.split(':::')[1]
            : otherResource;

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

  optimizeStatementsWithPathSeparation(statements: PermissionStatements[]): PermissionStatements[] {
    if (!statements || !Array.isArray(statements) || statements.length === 0) {
      return [];
    }

    const exactPathGroups: Record<
      string,
      Record<string, { resources: string[]; actions: PermissionsAction[] }>
    > = {};

    statements.forEach((stmt) => {
      if (!stmt.resources || !Array.isArray(stmt.resources) || stmt.resources.length === 0) {
        return;
      }

      stmt.resources.forEach((resource) => {
        const pathMatch = resource.includes(':::') ? resource.split(':::')[1] : resource;
        const exactPath = pathMatch ? pathMatch : '_other';

        if (!exactPathGroups[exactPath]) {
          exactPathGroups[exactPath] = {};
        }

        // Create action key
        const actionKey = [...stmt.actions].sort().join(',');

        // Initialize or update entry for this action set within the exact path
        if (!exactPathGroups[exactPath][actionKey]) {
          exactPathGroups[exactPath][actionKey] = {
            resources: [],
            actions: [...stmt.actions],
          };
        }

        // Add the resource
        exactPathGroups[exactPath][actionKey].resources.push(resource);
      });
    });

    // Create optimized statements
    const optimizedStatements: PermissionStatements[] = [];

    Object.values(exactPathGroups).forEach((actionGroups) => {
      Object.values(actionGroups).forEach((group) => {
        if (group.resources.length > 0 && group.actions.length > 0) {
          optimizedStatements.push({
            actions: group.actions,
            resources: Array.from(new Set(group.resources)),
          });
        }
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

    const excludePathParts = excludePath.split('/');
    const pathParts = path.split('/');
    const mightCoverExcluded =
      pathParts.length < excludePathParts.length && excludePath.startsWith(path);

    if (isUnderParent && !isExcludedPath && !isParentOfExcluded && !mightCoverExcluded) {
      allCoveredPaths.push(path);
    }
  });

  return allCoveredPaths;
};
