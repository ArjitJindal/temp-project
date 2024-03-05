import React from 'react';
import { usePermissions } from '@/utils/user-utils';
import { Permission } from '@/apis';
import ForbiddenPage from '@/pages/403';

export function Authorized({
  required,
  children,
  showForbiddenPage = false,
}: {
  required: Permission[];
  children: React.ReactNode;
  showForbiddenPage?: boolean;
}) {
  const permissions = usePermissions();
  if (required.find((r) => !permissions.has(r))) {
    return showForbiddenPage ? <ForbiddenPage /> : null;
  }
  return <>{children}</>;
}
