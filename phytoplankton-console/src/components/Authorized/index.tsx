import React from 'react';
import { usePermissions } from '@/utils/user-utils';
import { Permission } from '@/apis';

export function Authorized({
  required,
  children,
}: {
  required: Permission[];
  children: React.ReactNode;
}) {
  const permissions = usePermissions();
  if (required.find((r) => !permissions.has(r))) {
    return <></>;
  }
  return <>{children}</>;
}
