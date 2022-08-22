import { RuleActionSettings } from './components/RuleActionSettings';
import { AuditLog } from './components/AuditLog';
import { WebhookSettings } from './components/WebhookSettings';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import SidebarPanel, { MenuSection } from '@/components/ui/SidebarPanel';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';

export default function SettingsPage() {
  const isAuditLogEnabled = useFeature('AUDIT_LOGS');
  const menuSections: (MenuSection | boolean)[] = [
    {
      name: 'RULES',
      menuItems: [{ name: 'Rule actions', content: <RuleActionSettings /> }],
    },
    isAuditLogEnabled && {
      name: 'ACCOUNT',
      menuItems: [{ name: 'Audit Log', content: <AuditLog /> }],
    },
    {
      name: 'DEVELOPERS',
      menuItems: [{ name: 'Webhooks', content: <WebhookSettings /> }],
    },
  ].filter(Boolean);
  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.settings')} description="Manage product settings.">
      <SidebarPanel menuSections={menuSections as MenuSection[]} />
    </PageWrapper>
  );
}
