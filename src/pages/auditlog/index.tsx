import AuditLogWrapper from './components/AuditLog/AuditLogWrapper';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';

export default function AuditLogPage() {
  const i18n = useI18n();
  return (
    <PageWrapper
      title={i18n('menu.auditlog')}
      description="Audit logs automatically track all the activity in your account"
    >
      <AuditLogWrapper />
    </PageWrapper>
  );
}
