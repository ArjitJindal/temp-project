/**
 * Check if a permission path matches a resource pattern
 * @param permPath The permission path to check
 * @param resource The resource pattern to match against
 * @returns Whether the permission path matches the resource pattern
 */
export const doesResourceMatch = (permPath: string, resource: string): boolean => {
  const resourcePathSegmentMatch = resource.match(/^frn:console:(?:[^:]+):::(.*)$/);
  const resourcePathSegment = resourcePathSegmentMatch ? resourcePathSegmentMatch[1] : null;

  if (resourcePathSegment === null) {
    return false;
  }

  if (resourcePathSegment === '*') {
    return true;
  }

  let match = false;
  if (!resourcePathSegment.endsWith('/*')) {
    if (permPath === resourcePathSegment) {
      match = true;
    }
  } else {
    const baseResourcePath = resourcePathSegment.slice(0, -2);
    if (permPath === baseResourcePath || permPath.startsWith(`${baseResourcePath}/`)) {
      match = true;
    }
  }
  return match;
};

/**
 * Check if a permission path is covered by a wildcard in the statements
 * @param permPath The permission path to check
 * @param statements The permission statements
 * @param action The action to check
 * @param tenantName The tenant name
 * @returns The wildcard resource that covers the permission path, or null if not covered
 */
export const isPermissionCoveredByWildcard = (
  permPath: string,
  statements: any[],
  action: 'read' | 'write',
  tenantName: string,
): string | null => {
  const pathSegments = permPath.split('/');
  const matchingWildcards: string[] = [];

  for (let i = pathSegments.length - 1; i > 0; i--) {
    const parentPath = pathSegments.slice(0, i).join('/');
    const parentWildcard = `frn:console:${tenantName}:::${parentPath}/*`;

    for (const stmt of statements) {
      const hasMatchingResource = stmt.resources.some((res: string) => res === parentWildcard);
      const hasMatchingAction = stmt.actions.includes(action);

      if (hasMatchingResource && hasMatchingAction) {
        const matchedResource = stmt.resources.find((res: string) => res === parentWildcard);
        matchingWildcards.push(matchedResource || parentWildcard);
      }
    }
  }

  if (matchingWildcards.length === 0) {
    return null;
  }

  return matchingWildcards[0];
};

/**
 * Get sibling permissions from a permission tree
 * @param permPath The permission path
 * @param permissionsResponse The permissions response from the API
 * @returns Array of sibling permission paths
 */
export const getSiblingPermissions = (permPath: string, permissionsResponse: any): string[] => {
  if (!permissionsResponse) {
    return [];
  }

  const permissions = permissionsResponse.value?.permissions || permissionsResponse.permissions;

  if (!permissions || !Array.isArray(permissions)) {
    return [];
  }

  const pathSegments = permPath.split('/');
  const parentPath = pathSegments.slice(0, pathSegments.length - 1).join('/');

  const siblings: string[] = [];

  const findAllPaths = (
    nodes: any[],
    currentPath: string = '',
    allPaths: string[] = [],
  ): string[] => {
    if (!nodes || !Array.isArray(nodes)) {
      return allPaths;
    }

    for (const node of nodes) {
      if (!node) {
        continue;
      }

      const nodeId = node.type === 'DYNAMIC' ? node.subType : node.id;
      const fullPath = currentPath ? `${currentPath}/${nodeId}` : nodeId;

      allPaths.push(fullPath);

      if (node.children && node.children.length > 0) {
        allPaths.push(`${fullPath}/*`);
      }

      if (node.children && node.children.length > 0) {
        findAllPaths(node.children, fullPath, allPaths);
      }
    }

    return allPaths;
  };

  const allPaths = findAllPaths(permissions);

  for (const path of allPaths) {
    if (path.endsWith('/*')) {
      continue;
    }

    const isDirectSibling =
      path.startsWith(parentPath + '/') &&
      path !== permPath &&
      path.split('/').length === pathSegments.length;

    if (isDirectSibling) {
      const wildcardPath = `${path}/*`;
      siblings.push(wildcardPath);
    }
  }

  return siblings;
};

/**
 * Validates a role name according to company requirements
 * @param name The role name to validate
 * @returns Object containing validity status and error message if invalid
 */
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
