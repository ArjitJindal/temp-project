import { Resource } from '@flagright/lib/utils';
import { hasMinimumPermission } from '../user-utils';
import { useResources } from '@/components/AppWrapper/Providers/SettingsProvider';

export function useFilterByPermissions<T>(items: T[], getResource: (item: T) => string): T[] {
  const { statements } = useResources();

  return items.filter((item) => {
    const resource = getResource(item);
    const requiredResources: Resource[] = [`read:::${resource}` as Resource];
    return hasMinimumPermission(statements, requiredResources);
  });
}

export function filterByPermissions<T>(
  items: T[],
  getResource: (item: T) => string,
  statements: any[],
): T[] {
  return items.filter((item) => {
    const resource = getResource(item);
    const requiredResources: Resource[] = [`read:::${resource}` as Resource];
    return hasMinimumPermission(statements, requiredResources);
  });
}

/**
 * Check if user has exact permission for a specific resource
 */
export function hasExactPermission(statements: any[], resource: string): boolean {
  return statements.some((statement) => {
    if (!statement.actions.includes('read') && !statement.actions.includes('write')) {
      return false;
    }

    return statement.resources.some((statementResource: string) => {
      const [, normalizedResource] = statementResource.split(':::');
      if (!normalizedResource) {
        return false;
      }

      // Exact match
      if (normalizedResource === resource) {
        return true;
      }

      // Global wildcard
      if (normalizedResource === '*') {
        return true;
      }

      // Wildcard matching: if statement resource ends with /*, check if the required resource starts with the prefix
      if (normalizedResource.endsWith('/*')) {
        const prefix = normalizedResource.slice(0, -2); // Remove /*
        return resource.startsWith(prefix + '/');
      }

      return false;
    });
  });
}
