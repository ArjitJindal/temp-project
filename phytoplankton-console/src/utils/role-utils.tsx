import { useMemo } from 'react';
import { useRoles } from '@/utils/api/auth';
import { useAccountRawRole } from '@/utils/user-utils';
import { isSuccess } from '@/utils/asyncResource';

/**
 * Hook to convert a role ID to its display name
 * Falls back to the role ID if not found
 */
export function useRoleNameFromId(roleId: string | null | undefined): string {
  const { roles: rolesRes } = useRoles();

  return useMemo(() => {
    if (!roleId) {
      return '';
    }

    if (isSuccess(rolesRes.data)) {
      const role = rolesRes.data.value.items.find((r) => r.id === roleId);
      return role?.name ?? roleId;
    }

    return roleId;
  }, [roleId, rolesRes.data]);
}

/**
 * Hook to get the current user's role ID (not name)
 * Returns null if role not found
 */
export function useCurrentUserRoleId(): string | null {
  const currentRoleName = useAccountRawRole();
  const { roles: rolesRes } = useRoles();

  return useMemo(() => {
    if (!currentRoleName) {
      return null;
    }

    if (isSuccess(rolesRes.data)) {
      const role = rolesRes.data.value.items.find((r) => r.name === currentRoleName);
      return role?.id ?? null;
    }

    return null;
  }, [currentRoleName, rolesRes.data]);
}

/**
 * Hook to check if current user's role matches a given role ID
 */
export function useIsCurrentUserRole(roleId: string | null | undefined): boolean {
  const currentUserRoleId = useCurrentUserRoleId();

  return useMemo(() => {
    if (!roleId || !currentUserRoleId) {
      return false;
    }
    return currentUserRoleId === roleId;
  }, [roleId, currentUserRoleId]);
}
