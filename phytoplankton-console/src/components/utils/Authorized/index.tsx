import React, { useMemo } from 'react';
import {
  usePermissions,
  useHasResources,
  Resource,
  useHasMinimumPermission,
} from '@/utils/user-utils';
import { Permission } from '@/apis';
import ForbiddenPage from '@/pages/403';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export function Authorized({
  required,
  requiredResources,
  children,
  showForbiddenPage = false,
}: {
  required: Permission[];
  requiredResources: Resource[];
  children: React.ReactNode;
  showForbiddenPage?: boolean;
}) {
  const permissions = usePermissions();
  const resources = useHasResources(requiredResources ?? []);
  const isRbacV2Enabled = useFeatureEnabled('RBAC_V2');

  const isEnabled = useMemo(() => {
    if (isRbacV2Enabled && requiredResources?.length) {
      return resources;
    }

    return required.every((r) => permissions.has(r));
  }, [isRbacV2Enabled, permissions, required, resources, requiredResources]);

  if (isEnabled) {
    return <>{children}</>;
  }

  return showForbiddenPage ? <ForbiddenPage /> : null;
}

export function AuthorizedResource({
  minRequiredResources,
  children,
}: {
  minRequiredResources: Resource[];
  children: React.ReactNode;
}) {
  const resources = useHasMinimumPermission([], minRequiredResources ?? []);
  const isRbacV2Enabled = useFeatureEnabled('RBAC_V2');

  if (isRbacV2Enabled && minRequiredResources?.length) {
    return resources ? <>{children}</> : null;
  }

  return <>{children}</>;
}
