import { useNavigate, useParams } from 'react-router';
import { Tabs } from 'antd';
import { RuleActionSettings } from './components/RuleActionSettings';
import { PaymentApprovalSettings } from './components/PaymentApprovalSettings';
import { WebhookSettings } from './components/WebhookSettings';
import { TransactionStateSettings } from './components/TransactionStateSettings';
import { RiskLevelSettings } from './components/RiskLevelSettings';
import { FlagrightAISettings } from './components/FlagrightAISettings';
import { DefaultValuesSettings } from './components/DefaultValuesSettings';
import { RiskAlgorithmsSettings } from './components/RiskAlgorithmsSettings';
import NarrativeTemplates from './components/NarrativeTemplates';
import { QuotaSettings } from './components/QuotaSettings';
import { KYCUserStatusSettings } from './components/KYCUserStatusSettings';
import { ApiKeysSettings } from './components/ApiKeysSettings';
import { ChecklistTemplatesSettings } from './components/ChecklistTemplatesSettings';
import { EmailNotificationsSettings } from './components/EmailNotificationsSettings';
import { SlackNotificationsSettings } from './components/SlackNotificationsSettings';
import { ProfessionalServicesSettings } from './components/ProfessionalServicesSettings';
import { SanctionsSettings } from './components/SanctionsSettings';
import { ProductionAccessControl } from './components/ProductionAccessControl';
import { AISources } from './components/AISources';
import { RuleQueuesSettings } from './components/RuleQueuesSettings';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { Feature, useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import PageTabs from '@/components/ui/PageTabs';
import { makeUrl } from '@/utils/routing';

export default function SettingsPage() {
  const isMLDemoEnabled = useFeatureEnabled('MACHINE_LEARNING_DEMO');

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
      >
        <Tabs.TabPane tab={i18n('menu.settings.system')} key={'system'}>
          <DefaultValuesSettings />
          <ProductionAccessControl />
        </Tabs.TabPane>
        <Tabs.TabPane tab={i18n('menu.settings.case-management')} key={'case-management'}>
          <>
            <NarrativeTemplates />
            <ChecklistTemplatesSettings />
            <RuleQueuesSettings />
            <Feature name="COPILOT">
              <AISources />
            </Feature>
          </>
        </Tabs.TabPane>
        <Tabs.TabPane tab={i18n('menu.settings.transactions')} key={'transactions'}>
          <>
            <PaymentApprovalSettings />
            <TransactionStateSettings />
          </>
        </Tabs.TabPane>

        <Tabs.TabPane tab={i18n('menu.settings.users')} key={'users'}>
          <KYCUserStatusSettings />
        </Tabs.TabPane>
        <Tabs.TabPane tab={i18n('menu.settings.rules')} key={'rules'}>
          <RuleActionSettings />
        </Tabs.TabPane>
        <Tabs.TabPane tab={i18n('menu.settings.risk-scoring')} key={'risk-scoring'}>
          {isMLDemoEnabled ? <RiskAlgorithmsSettings /> : ''}
          <RiskLevelSettings />
        </Tabs.TabPane>
        <Tabs.TabPane tab={i18n('menu.settings.notifications')} key={'notifications'}>
          <SlackNotificationsSettings />
          <EmailNotificationsSettings />
        </Tabs.TabPane>
        <Tabs.TabPane tab={i18n('menu.settings.addons')} key={'addons'}>
          <FlagrightAISettings />
          <ProfessionalServicesSettings />
          <SanctionsSettings />
        </Tabs.TabPane>
        <Tabs.TabPane tab={i18n('menu.settings.developers')} key={'developers'}>
          <ApiKeysSettings />
          <QuotaSettings />
          <WebhookSettings />
        </Tabs.TabPane>
      </PageTabs>
    </PageWrapper>
  );
}
