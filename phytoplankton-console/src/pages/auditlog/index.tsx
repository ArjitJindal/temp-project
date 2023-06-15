import React, { useState } from 'react';
import Switch from 'react-switch';
import AuditLog from './components/AuditLog/AuditLog';
import COLORS from '@/components/ui/colors';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { usePageViewTracker } from '@/utils/tracker';
import { isSuperAdmin, useAuth0User } from '@/utils/user-utils';
import SuperAdminContainer from '@/components/library/SuperAdminContainer';

export const AuditLogPageContext = React.createContext<{ includeRootUserRecords: boolean } | null>(
  null,
);

export default function AuditLogPage() {
  const i18n = useI18n();
  const user = useAuth0User();
  const [includeRootUserRecords, setIncludeRootUserRecords] = useState(false);
  usePageViewTracker('Audit Log');
  return (
    <PageWrapper
      title={i18n('menu.auditlog')}
      description="Audit logs automatically track all the activity in your account"
      actionButton={
        isSuperAdmin(user) && (
          <SuperAdminContainer
            tooltip="Turn on to make the audit logs from super admin users visible."
            tooltipPlacement="left"
          >
            <Switch
              height={20}
              width={40}
              uncheckedIcon={false}
              checkedIcon={false}
              onColor={COLORS.red.base}
              checked={includeRootUserRecords}
              onChange={(v) => setIncludeRootUserRecords(v as boolean)}
            />
          </SuperAdminContainer>
        )
      }
    >
      <AuditLogPageContext.Provider value={{ includeRootUserRecords }}>
        <AuditLog />
      </AuditLogPageContext.Provider>
    </PageWrapper>
  );
}
