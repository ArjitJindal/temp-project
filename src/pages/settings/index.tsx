import { AddToSlackButton } from '../case-management/components/AddToSlackButton';
import { RuleActionSettings } from './components/RuleActionSettings';
import { WebhookSettings } from './components/WebhookSettings';
import { TransactionStateSettings } from './components/TransactionStateSettings';
import { RiskLevelSettings } from './components/RiskLevelSettings';
import { DefaultValuesSettings } from './components/DefaultValuesSettings';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import SidebarPanel, { MenuSection } from '@/components/ui/SidebarPanel';
import Button from '@/components/library/Button';
import { usePageViewTracker } from '@/utils/tracker';
import { DefaultViewsSettings } from '@/pages/settings/components/DefaultViewsSettings';
import { getBranding } from '@/utils/branding';

const branding = getBranding();

export default function SettingsPage() {
  usePageViewTracker('Settings');
  const menuSections: (MenuSection | boolean)[] = [
    {
      name: 'ORGANIZATION',
      menuItems: [
        {
          name: 'Default Values',
          content: <DefaultValuesSettings />,
        },
        {
          name: 'Default Views',
          content: <DefaultViewsSettings />,
        },
        {
          name: 'Billing',
          content: <div>Billing</div>,
          disabled: true,
        },
      ],
    },
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
        {
          name: 'Risk levels',
          content: <RiskLevelSettings />,
        },
      ],
    },
    {
      name: 'ADD-ONS',
      menuItems: [
        {
          name: 'Sanctions/PEP/Adverse media screening',
          content: (
            <>
              <div style={{ marginTop: '200px' }}>
                <h3>Sanctions/PEP/Adverse media screening{'     '}</h3>
                <a href={`mailto:${branding.supportEmail}`}>
                  <Button type="PRIMARY">Request access</Button>
                </a>
              </div>
            </>
          ),
        },
        {
          name: 'Sage: KYC/KYB Orchestrator',
          content: (
            <>
              <div style={{ marginTop: '200px' }}>
                <h3>Sage: KYC/KYB Orchestrator{'     '}</h3>
                <a href={`mailto:${branding.supportEmail}`}>
                  <Button type="PRIMARY">Request access</Button>
                </a>
              </div>
            </>
          ),
        },
        {
          name: 'Blockchain analytics',
          content: (
            <>
              <div style={{ marginTop: '200px' }}>
                <h3>Blockchain analytics{'     '}</h3>
                <a href={`mailto:${branding.supportEmail}`}>
                  <Button type="PRIMARY"> Request access</Button>
                </a>
              </div>
            </>
          ),
        },
        {
          name: 'Launchpad: Get expert support for fintech licensing',
          content: (
            <>
              <div style={{ marginTop: '200px' }}>
                <h3>Launchpad: Get expert support for fintech licensing{'     '}</h3>
                <a href={`mailto:${branding.supportEmail}`}>
                  <Button type="PRIMARY"> Request access</Button>
                </a>
              </div>
            </>
          ),
        },
      ],
    },
    {
      name: 'ALERTS',
      menuItems: [
        {
          name: 'Slack',
          content: (
            <>
              <div style={{ marginTop: '200px' }}>
                <h3>Slack{'     '}</h3>
                <AddToSlackButton />{' '}
              </div>
            </>
          ),
        },
        {
          name: 'Email',
          content: (
            <>
              <div style={{ marginTop: '200px' }}>
                <a href={`mailto:${branding.supportEmail}`}>
                  <Button type="PRIMARY">Request access</Button>
                </a>
              </div>
            </>
          ),
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
