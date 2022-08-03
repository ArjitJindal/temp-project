import { RuleActionSettings } from './components/RuleActionSettings';
import { AuditLog } from './components/AuditLog';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import SidebarPanel from '@/components/ui/SidebarPanel';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';

export default function SettingsPage() {
  const isAuditLogEnabled = useFeature('AUDIT_LOGS');
  const menuSections = [
    {
      name: 'RULES',
      menuItems: [{ name: 'Rule actions', content: <RuleActionSettings /> }],
    },
  ];
  if (isAuditLogEnabled) {
    menuSections.push({
      name: 'ACCOUNT',
      menuItems: [{ name: 'Audit Log', content: <AuditLog /> }],
    });
  }
  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.settings')} description="Manage product settings.">
      <SidebarPanel menuSections={menuSections} />
    </PageWrapper>
  );
}
