import { RuleActionSettings } from './components/RuleActionSettings';
import { WebhookSettings } from './components/WebhookSettings';
import { TransactionStateSettings } from './components/TransactionStateSettings';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import SidebarPanel, { MenuSection } from '@/components/ui/SidebarPanel';

export default function SettingsPage() {
  const menuSections: (MenuSection | boolean)[] = [
    {
      name: 'NOMENCLATURE',
      menuItems: [
        {
          name: 'Rule actions',
          content: <RuleActionSettings />,
        },
        {
          name: 'Transaction states',
          content: <TransactionStateSettings />,
        },
      ],
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
