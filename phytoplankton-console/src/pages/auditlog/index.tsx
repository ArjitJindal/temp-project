import AuditLog from './components/AuditLog/AuditLog';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { usePageViewTracker } from '@/utils/tracker';

export default function AuditLogPage() {
  const i18n = useI18n();
  usePageViewTracker('Audit Log');
  return (
    <PageWrapper
      title={i18n('menu.auditlog')}
      description="Audit logs automatically track all the activity in your account"
      superAdminMode={{ tooltip: 'Turn on to make the audit logs from super admin users visible.' }}
    >
      <AuditLog />
    </PageWrapper>
  );
}
