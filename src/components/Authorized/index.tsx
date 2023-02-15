import React from 'react';
import { usePermissions } from '@/utils/user-utils';
import { Permission } from '@/apis';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export default function ({
  required,
  children,
}: {
  required: Permission[];
  children: React.ReactNode;
}) {
  if (!useFeatureEnabled('RBAC')) {
    return <>{children}</>;
  }
  const permissions = usePermissions();
  if (required.find((r) => !permissions.has(r))) {
    return <></>;
  }
  return <>{children}</>;
}
