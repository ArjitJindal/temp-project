import { AddToSlackButton } from '../case-management/components/AddToSlackButton';
import { RuleActionSettings } from './components/RuleActionSettings';
import { WebhookSettings } from './components/WebhookSettings';
import { TransactionStateSettings } from './components/TransactionStateSettings';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import SidebarPanel, { MenuSection } from '@/components/ui/SidebarPanel';
import Button from '@/components/ui/Button';

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
      name: 'ADD-ONS',
      menuItems: [
        {
          name: 'Sanctions/PEP/Adverse media screening',
          content: (
            <>
              <div style={{ marginTop: '200px' }}>
                <h3>Sanctions/PEP/Adverse media screening{'     '}</h3>
                <Button
                  href="mailto:support@flagright.com"
                  type="primary"
                  className="justify-content"
                >
                  Request access
                </Button>
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
                <Button
                  href="mailto:support@flagright.com"
                  type="primary"
                  className="justify-content"
                >
                  {' '}
                  Request access
                </Button>
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
                <Button
                  href="mailto:support@flagright.com"
                  type="primary"
                  className="justify-content"
                >
                  {' '}
                  Request access
                </Button>
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
                <Button
                  href="mailto:support@flagright.com"
                  type="primary"
                  className="justify-content"
                >
                  {' '}
                  Request access
                </Button>
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
                <Button
                  href="mailto:support@flagright.com"
                  type="primary"
                  className="justify-content"
                >
                  {' '}
                  Request access
                </Button>
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
