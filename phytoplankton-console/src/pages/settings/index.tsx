import { useNavigate, useParams } from 'react-router';
import { RuleActionSettings } from './components/RuleActionSettings';
import { PaymentApprovalSettings } from './components/PaymentApprovalSettings';
import { WebhookConfigurations } from './components/WebhookConfigurations';
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
import { FlagrightMLSettings } from './components/FlagtightMLSettings';
import SlaPolicySettings from './components/SlaPolicySettings';
import { SecuritySettings } from './components/SecuritySettings';
import RiskAlgorithmsCra from './components/RiskAlgorithmsCra';
import CraToggleSettings from './components/CraToggleSettings';
import { PepStatusConfigSettings } from './components/PepStatusConfigSettings';
import TagSettings from './components/TagSettings';
import ReRunTriggerSettings from './components/ReRunTriggerSettings';
import { WebhookSettings } from './components/WebhookSettings';
import { ReasonsSettings } from './components/ReasonsSettings';
import { CRMSettings } from './components/CRMSettings';
import UserAliasSettings from './components/UserAliasSettings/UserAliasSettings';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import {
  Feature,
  useFreshdeskCrmEnabled,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl } from '@/utils/routing';
import Alert from '@/components/library/Alert';
import { useDemoMode } from '@/components/AppWrapper/Providers/DemoModeProvider';
import { getOr } from '@/utils/asyncResource';
import { AuthorizedResource } from '@/components/utils/Authorized';

export default function SettingsPage() {
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
  const [isDemoModeRes] = useDemoMode();
  const isDemoMode = getOr(isDemoModeRes, false);
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
            requiredPermissions: ['settings:system-config:read'],
            minRequiredResources: ['read:::settings/system-config/*'],
            children: (
              <>
                <DefaultValuesSettings />
                <ProductionAccessControl />
              </>
            ),
          },
          {
            title: i18n('menu.settings.security'),
            key: 'security',
            children: <SecuritySettings />,
            requiredPermissions: ['settings:security:read'],
            minRequiredResources: ['read:::settings/security/*'],
          },

          {
            title: i18n('menu.settings.case-management'),
            key: 'case-management',
            requiredPermissions: ['settings:case-management:read'],
            minRequiredResources: ['read:::settings/case-management/*'],
            children: (
              <>
                <NarrativeTemplatesSettings />
                <ChecklistTemplatesSettings />
                <RuleQueuesSettings />
                <Feature name="ALERT_SLA">
                  <SlaPolicySettings />
                </Feature>
                <Feature name="NARRATIVE_COPILOT">
                  <AISources />
                </Feature>
                <Feature name="NARRATIVE_COPILOT">
                  <NarrativeCopilot />
                </Feature>
                <ReasonsSettings />
              </>
            ),
          },
          {
            title: i18n('menu.settings.transactions'),
            key: 'transactions',
            requiredPermissions: ['settings:transactions:read'],
            minRequiredResources: ['read:::settings/transactions/*'],
            children: (
              <>
                <PaymentApprovalSettings />
                <TransactionStateSettings />
              </>
            ),
          },
          {
            title: i18n('menu.settings.users'),
            key: 'users',
            requiredPermissions: ['settings:users:read'],
            minRequiredResources: ['read:::settings/users/*'],
            children: (
              <>
                <KYCUserStatusSettings />
                <PepStatusConfigSettings />
                <TagSettings />
                <UserAliasSettings />
              </>
            ),
          },
          {
            title: i18n('menu.settings.rules'),
            key: 'rules',
            requiredPermissions: ['settings:rules:read'],
            minRequiredResources: ['read:::settings/rules/*'],
            children: <RuleActionSettings />,
          },
          {
            title: i18n('menu.settings.risk-scoring'),
            key: 'risk-scoring',
            requiredPermissions: ['settings:risk-scoring:read'],
            minRequiredResources: ['read:::settings/risk-scoring/*'],
            children: (
              <>
                <Feature name="RISK_SCORING">
                  <RiskAlgorithmsSettings />
                </Feature>
                <Feature name="RISK_SCORING">
                  <CraToggleSettings />
                  <RiskAlgorithmsCra />
                  <ReRunTriggerSettings />
                </Feature>
                <RiskLevelSettings />
              </>
            ),
          },
          {
            title: i18n('menu.settings.notifications'),
            key: 'notifications',
            requiredPermissions: ['settings:notifications:read'],
            minRequiredResources: ['read:::settings/notifications/*'],
            children: (
              <>
                <SlackNotificationsSettings />
                <EmailNotificationsSettings />
                <AuthorizedResource
                  minRequiredResources={['read:::settings/notifications/notification-settings/*']}
                >
                  <NotificationsSettings />
                </AuthorizedResource>
              </>
            ),
          },
          {
            title: i18n('menu.settings.screening'),
            key: 'sanctions',
            requiredPermissions: ['settings:screening:read'],
            minRequiredResources: ['read:::settings/screening/*'],
            children: <SanctionsSettings />,
          },
          {
            title: i18n('menu.settings.addons'),
            key: 'addons',
            requiredPermissions: ['settings:add-ons:read'],
            minRequiredResources: ['read:::settings/add-ons/*'],
            children: (
              <>
                <FlagrightAISettings />
                <FlagrightMLSettings />
                {useFreshdeskCrmEnabled() && <CRMSettings />}
              </>
            ),
          },
          {
            title: i18n('menu.settings.developers'),
            key: 'developers',
            requiredPermissions: ['settings:developers:read'],
            minRequiredResources: ['read:::settings/developers/*'],
            children: (
              <>
                {isDemoMode && (
                  <div style={{ marginBottom: '8px' }}>
                    <Alert type={'WARNING'}>Please disable demo mode before testing the API.</Alert>
                  </div>
                )}
                <ApiKeysSettings />
                <QuotaSettings />
                <WebhookSettings />
                <WebhookConfigurations />
              </>
            ),
          },
        ]}
      />
    </PageWrapper>
  );
}
