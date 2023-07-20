import { AddToSlackButton } from '../case-management/components/AddToSlackButton';
import { RuleActionSettings } from './components/RuleActionSettings';
import { PaymentApprovalSettings } from './components/PaymentApprovalSettings';
import { WebhookSettings } from './components/WebhookSettings';
import { TransactionStateSettings } from './components/TransactionStateSettings';
import { RiskLevelSettings } from './components/RiskLevelSettings';
import { FlagrightAISettings } from './components/FlagrightAISettings';
import { DefaultValuesSettings } from './components/DefaultValuesSettings';
import { RiskAlgorithmsSettings } from './components/RiskAlgorithmsSettings';
import { OtherSettings } from './components/OtherSettings';
import NarrativeTemplates from './components/NarrativeTemplates';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import SidebarPanel, { MenuSection } from '@/components/ui/SidebarPanel';
import Button from '@/components/library/Button';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { usePageViewTracker } from '@/utils/tracker';
import { getBranding, isWhiteLabeled } from '@/utils/branding';

const branding = getBranding();
const whiteLabeled = isWhiteLabeled();
export default function SettingsPage() {
  const isMLDemoEnabled = useFeatureEnabled('MACHINE_LEARNING_DEMO');
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
          name: 'Narrative templates',
          content: <NarrativeTemplates />,
        },
        {
          name: whiteLabeled ? 'AI Features' : 'Flagright AI Features',
          content: <FlagrightAISettings />,
        },
        {
          name: 'Payment Approval',
          content: <PaymentApprovalSettings />,
        },
        {
          name: 'Other settings',
          content: <OtherSettings />,
        },
        {
          name: 'Billing',
          content: <div>Billing</div>,
          disabled: true,
        },
      ],
    },
    isMLDemoEnabled
      ? {
          name: 'MACHINE LEARNING',
          menuItems: [
            {
              name: 'Risk Algorithms',
              content: <RiskAlgorithmsSettings />,
            },
          ],
        }
      : false,
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
          name: 'KYB & ID Verification',
          content: (
            <>
              <div style={{ marginTop: '200px' }}>
                <h3>KYB & ID Verification{'     '}</h3>
                <a href={`mailto:${branding.supportEmail}`}>
                  <Button type="PRIMARY">Request access</Button>
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
