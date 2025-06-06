import React from 'react';
import { Resource } from '@flagright/lib/utils';
import { useHasMinimumPermission } from '@/utils/user-utils';
import ForbiddenPage from '@/pages/403';

export function Authorized({
  minRequiredResources,
  children,
  showForbiddenPage = false,
}: {
  minRequiredResources: Resource[];
  children: React.ReactNode;
  showForbiddenPage?: boolean;
}) {
  const resources = useHasMinimumPermission(minRequiredResources ?? []);

  if (resources) {
    return <>{children}</>;
  }

  return showForbiddenPage ? <ForbiddenPage /> : null;
}
