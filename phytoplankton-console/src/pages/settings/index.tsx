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
import s from './styles.module.less';
import { QuotaSettings } from './components/QuotaSettings';
import { ChecklistTemplatesSettings } from './components/ChecklistTemplatesSettings';
import ComplyAdvantageLogo from '@/branding/Comply-Advantage-logo.svg';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import SidebarPanel, { MenuSection } from '@/components/ui/SidebarPanel';
import Button from '@/components/library/Button';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { getBranding, isWhiteLabeled } from '@/utils/branding';
import { message } from '@/components/library/Message';

const branding = getBranding();
const whiteLabeled = isWhiteLabeled();
export default function SettingsPage() {
  const isMLDemoEnabled = useFeatureEnabled('MACHINE_LEARNING_DEMO');
  const isSanctionsEnabled = useFeatureEnabled('SANCTIONS');

  const handleDownload = () => {
    message.success('Sanctions list download started');
    const downloadLink = document.createElement('a');
    downloadLink.href =
      'https://phytoplankton-assets-sanctionslist.s3.eu-central-1.amazonaws.com/Data+Compliance+Overview+January+2023.xlsx';
    // Sanctions list has been stored in a s3 bucket with the name 'phytoplankton-assets-sanctionslist'
    downloadLink.download = 'File.xlsx';
    downloadLink.click();
  };

  const menuSections: (MenuSection | boolean)[] = [
    {
      name: 'ORGANIZATION',
      menuItems: [
        {
          name: 'Default values',
          content: <DefaultValuesSettings />,
        },
        {
          name: 'Narrative templates',
          content: <NarrativeTemplates />,
        },
        {
          name: 'Investigation checklist',
          content: <ChecklistTemplatesSettings />,
        },
        {
          name: whiteLabeled ? 'AI features' : 'Flagright AI features',
          content: <FlagrightAISettings />,
        },
        {
          name: 'Payment approval',
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
              name: 'Risk algorithms',
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
          content: isSanctionsEnabled ? (
            <>
              <div className={s.sanctionsModal}>
                <div className={s.sanctionsLayout}>
                  <h3 className={s.sanctionsHeading}>
                    Sanctions list (as of the 31 January, 2023){'     '}
                  </h3>
                  <img src={ComplyAdvantageLogo} alt="Comply Advantage" />
                </div>
                <div className={s.sanctionsText}>
                  ComplyAdvantage data provides a holistic solution to due diligence and compliance
                  requirements. Their global data sources are continuously updated, reflecting the
                  ever-changing risks to corporates and financial institutions in their dealings
                  with global counterparties. The data includes millions of profiles on high-risk
                  individuals and corporations worldwide.
                </div>
                <div className={s.sanctionsDownloadButton}>
                  <Button
                    type="PRIMARY"
                    onClick={() => {
                      handleDownload();
                    }}
                  >
                    Download List
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <h3>Sanctions/PEP/Adverse media screening{'     '}</h3>
                <a href={`mailto:${branding.supportEmail}`} className={s.sanctionsAccessButton}>
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
      menuItems: [
        {
          name: 'Webhooks',
          content: <WebhookSettings />,
        },
        {
          name: 'Quotas',
          content: <QuotaSettings />,
        },
      ],
    },
  ].filter(Boolean);

  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.settings')} description="Manage system settings">
      <SidebarPanel menuSections={menuSections as MenuSection[]} />
    </PageWrapper>
  );
}
