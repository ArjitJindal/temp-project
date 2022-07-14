import { RuleActionSettings } from './components/RuleActionSettings';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import SidebarPanel from '@/components/ui/SidebarPanel';

export default function SettingsPage() {
  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.settings')} description="Manage product settings.">
      <SidebarPanel
        menuSections={[
          {
            name: 'RULES',
            menuItems: [{ name: 'Rule actions', content: <RuleActionSettings /> }],
          },
        ]}
      />
    </PageWrapper>
  );
}
