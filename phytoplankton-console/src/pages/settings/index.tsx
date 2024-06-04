import { useNavigate, useParams } from 'react-router';
import { RuleActionSettings } from './components/RuleActionSettings';
import { PaymentApprovalSettings } from './components/PaymentApprovalSettings';
import { WebhookSettings } from './components/WebhookSettings';
import { TransactionStateSettings } from './components/TransactionStateSettings';
import { RiskLevelSettings } from './components/RiskLevelSettings';
import { FlagrightAISettings } from './components/FlagrightAISettings';
import { DefaultValuesSettings } from './components/DefaultValuesSettings';
import { RiskAlgorithmsSettings } from './components/RiskAlgorithmsSettings';
import { QuotaSettings } from './components/QuotaSettings';
import { KYCUserStatusSettings } from './components/KYCUserStatusSettings';
import { ApiKeysSettings } from './components/ApiKeysSettings';
import { ChecklistTemplatesSettings } from './components/ChecklistTemplatesSettings';
import { EmailNotificationsSettings } from './components/EmailNotificationsSettings';
import { SlackNotificationsSettings } from './components/SlackNotificationsSettings';
import { SanctionsSettings } from './components/SanctionsSettings';
import { ProductionAccessControl } from './components/ProductionAccessControl';
import { AISources } from './components/AISources';
import { RuleQueuesSettings } from './components/RuleQueuesSettings';
import { NarrativeTemplatesSettings } from './components/NarrativeTemplateSettings';
import { NotificationsSettings } from './components/NotificationSettings';
import { NarrativeCopilot } from './components/NarrativeCopilot';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { Feature, useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl } from '@/utils/routing';
import { useHasPermissions } from '@/utils/user-utils';

export default function SettingsPage() {
  const isRiskScoreEnabled = useFeatureEnabled('RISK_SCORING');
  const isDevelopersReadEnabled = useHasPermissions(['settings:developers:read']);

  const { section = 'system' } = useParams<'section'>() as {
    section:
      | 'system'
      | 'case-management'
      | 'transactions'
      | 'users'
      | 'rules'
      | 'risk-scoring'
      | 'notifications'
      | 'addons'
      | 'developers';
  };
  const navigate = useNavigate();
  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.settings')}>
      <PageTabs
        activeKey={section}
        onChange={(section) => {
          navigate(makeUrl(`/settings/:section`, { section }), { replace: true });
        }}
        items={[
          {
            title: i18n('menu.settings.system'),
            key: 'system',
            children: (
              <>
                <DefaultValuesSettings />
                <ProductionAccessControl />
              </>
            ),
          },
          {
            title: i18n('menu.settings.case-management'),
            key: 'case-management',
            children: (
              <>
                <NarrativeTemplatesSettings />
                <ChecklistTemplatesSettings />
                <RuleQueuesSettings />
                <Feature name="NARRATIVE_COPILOT">
                  <AISources />
                </Feature>
                <Feature name="NARRATIVE_COPILOT">
                  <NarrativeCopilot />
                </Feature>
              </>
            ),
          },
          {
            title: i18n('menu.settings.transactions'),
            key: 'transactions',
            children: (
              <>
                <PaymentApprovalSettings />
                <TransactionStateSettings />
              </>
            ),
          },
          { title: i18n('menu.settings.users'), key: 'users', children: <KYCUserStatusSettings /> },
          { title: i18n('menu.settings.rules'), key: 'rules', children: <RuleActionSettings /> },
          {
            title: i18n('menu.settings.risk-scoring'),
            key: 'risk-scoring',
            children: (
              <>
                {isRiskScoreEnabled ? <RiskAlgorithmsSettings /> : ''}
                <RiskLevelSettings />
              </>
            ),
          },
          {
            title: i18n('menu.settings.notifications'),
            key: 'notifications',
            children: (
              <>
                <SlackNotificationsSettings />
                <EmailNotificationsSettings />
                <NotificationsSettings />
              </>
            ),
          },
          {
            title: i18n('menu.settings.addons'),
            key: 'addons',
            children: (
              <>
                <FlagrightAISettings />
                <SanctionsSettings />
              </>
            ),
          },
          {
            title: i18n('menu.settings.developers'),
            key: 'developers',
            isDisabled: !isDevelopersReadEnabled,
            children: (
              <>
                <ApiKeysSettings />
                <QuotaSettings />
                <WebhookSettings />
              </>
            ),
          },
        ]}
      />
    </PageWrapper>
  );
}
