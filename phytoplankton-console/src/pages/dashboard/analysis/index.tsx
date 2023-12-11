import { useMemo, useState } from 'react';
import { useLocalStorageState } from 'ahooks';
import { kebabCase } from 'lodash';
import TransactionsChartWidget from './components/TransactionsChartWidget';
import PaymentMethodDistributionWidget from './components/Transactions/PaymentMethodDistributionWidget';
import RuleHitCard from './components/RulesHitCard';
import TopUsersHitCard from './components/TopUsersHitCard';
import {
  RiskLevelDistributionCard,
  RiskLevelBreakdownCard,
} from './components/RiskLevelDistributionCard';
import TeamPerformanceCard from './components/TeamPerformanceCard';
import OverviewCard from './components/OverviewCard';
import RulePrioritySplitCard from './components/RulePrioritySplitCard';
import CaseClosingReasonCard from './components/CaseManagement/CaseClosingReasonCard';
import DistributionByAlertPriority from './components/CaseManagement/DistributionByAlertPriority';
import TransactionTRSChartCard from './components/TransactionTRSChartCard';
import DistributionByTransactionTypeWidget from './components/Transactions/DistributionByTransactionTypeWidget';
import s from './style.module.less';
import RuleActionSplitCard from './components/RuleActionSplitCard';
import KYCStatusDistributionCard from './components/KYCStatusDistributionCard';
import DistributionByStatus from './components/CaseManagement/DistributionByStatus';
import UserStatusDistributionCard from './components/UserStatusDistributionCard';
import PageWrapper from '@/components/PageWrapper';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useI18n } from '@/locales';
import Button from '@/components/library/Button';
import IconSetting from '@/components/ui/icons/Remix/system/settings-2-line.react.svg';
import Drawer from '@/components/library/Drawer';
import Checkbox from '@/components/library/Checkbox';
import { humanizeConstant } from '@/utils/humanize';
import WidgetGrid from '@/components/library/WidgetGrid';
import Widget from '@/components/library/Widget';
import Label from '@/components/library/Label';
import { notEmpty } from '@/utils/array';
import { WidgetProps } from '@/components/library/Widget/types';

type KeyValues =
  | 'OVERVIEW'
  | 'TOP_CONSUMER_USERS_BY_RULE_HITS'
  | 'TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION'
  | 'TOP_RULE_HITS_BY_COUNT'
  | 'CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL'
  | 'CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL'
  | 'CONSUMER_USERS_DISTRIBUTION_BY_USER_STATUS'
  | 'TEAM_OVERVIEW'
  | 'BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL'
  | 'BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL'
  | 'BUSINESS_USERS_DISTRIBUTION_BY_USER_STATUS'
  | 'TOP_BUSINESS_USERS_BY_RULE_HITS'
  | 'DISTRIBUTION_BY_RULE_PRIORITY'
  | 'DISTRIBUTION_BY_CLOSING_REASON'
  | 'DISTRIBUTION_BY_ALERT_PRIORITY'
  | 'DISTRIBUTION_BY_PAYMENT_METHOD'
  | 'DISTRIBUTION_BY_TRANSACTION_TYPE'
  | 'DISTRIBUTION_BY_RULE_ACTION'
  | 'TRANSACTIONS_BREAKDOWN_BY_TRS'
  | 'CONSUMER_USERS_DISTRIBUTION_BY_KYC_STATUS'
  | 'BUSINESS_USERS_DISTRIBUTION_BY_KYC_STATUS'
  | 'DISTRIBUTION_BY_CASE_AND_ALERT_STATUS'
  | 'TRANSACTIONS_BREAKDOWN_BY_TRS';

const DEFAULT_VALUES = {
  OVERVIEW: true,
  TOP_CONSUMER_USERS_BY_RULE_HITS: true,
  TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION: true,
  TOP_RULE_HITS_BY_COUNT: true,
  CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL: true,
  CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL: true,
  BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL: true,
  TEAM_OVERVIEW: true,
  DISTRIBUTION_BY_RULE_PRIORITY: true,
  DISTRIBUTION_BY_CLOSING_REASON: true,
  BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL: true,
  TOP_BUSINESS_USERS_BY_RULE_HITS: true,
  DISTRIBUTION_BY_ALERT_PRIORITY: true,
  DISTRIBUTION_BY_PAYMENT_METHOD: true,
  DISTRIBUTION_BY_TRANSACTION_TYPE: true,
  TRANSACTIONS_BREAKDOWN_BY_TRS: true,
  DISTRIBUTION_BY_RULE_ACTION: true,
  CONSUMER_USERS_DISTRIBUTION_BY_KYC_STATUS: true,
  BUSINESS_USERS_DISTRIBUTION_BY_KYC_STATUS: true,
  DISTRIBUTION_BY_CASE_AND_ALERT_STATUS: true,
  CONSUMER_USERS_DISTRIBUTION_BY_USER_STATUS: true,
  BUSINESS_USERS_DISTRIBUTION_BY_USER_STATUS: true,
};

type WidgetType = {
  groupTitle: string;
  id: string;
  title: string;
  component: (props) => JSX.Element;
  width?: 'FULL' | 'HALF';
  userType?: 'CONSUMER' | 'BUSINESS';
  requiredFeatures?: string[];
  resizing?: 'AUTO';
  children?: React.ReactNode;
};

type WidgetGroup = WidgetType[];

interface Widgets {
  OVERVIEW: WidgetGroup;
  CONSUMER_USERS: WidgetGroup;
  BUSINESS_USERS: WidgetGroup;
  TRANSACTIONS: WidgetGroup;
  RULES: WidgetGroup;
  CASE_MANAGEMENT: WidgetGroup;
  TEAM_MANAGEMENT: WidgetGroup;
}

const WIDGETS: Widgets = {
  OVERVIEW: [
    {
      groupTitle: 'Overview',
      id: 'OVERVIEW',
      title: 'Overview',
      component: OverviewCard,
    },
  ],
  CONSUMER_USERS: [
    {
      groupTitle: 'Consumer users',
      id: 'CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL',
      title: 'Users distribution by risk levels',
      component: RiskLevelBreakdownCard,
      width: 'FULL' as const,
      userType: 'CONSUMER',
      requiredFeatures: ['RISK_SCORING'],
    },
    {
      groupTitle: 'Consumer users',
      id: 'CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL',
      title: 'Users breakdown by risk levels',
      component: RiskLevelDistributionCard,
      width: 'HALF' as const,
      userType: 'CONSUMER',
      requiredFeatures: ['RISK_SCORING'],
    },

    {
      groupTitle: 'Consumer users',
      id: 'TOP_CONSUMER_USERS_BY_RULE_HITS',
      title: 'Top users by rule hits',
      component: TopUsersHitCard,
      width: 'HALF' as const,
      userType: 'CONSUMER',
    },
    {
      groupTitle: 'Consumer users',
      id: 'CONSUMER_USERS_DISTRIBUTION_BY_KYC_STATUS',
      title: 'Users distribution by KYC status',
      component: KYCStatusDistributionCard,
      width: 'HALF' as const,
      userType: 'CONSUMER',
    },
    {
      groupTitle: 'Consumer users',
      id: 'CONSUMER_USERS_DISTRIBUTION_BY_USER_STATUS',
      title: 'Users distribution by user status',
      component: UserStatusDistributionCard,
      width: 'HALF' as const,
      userType: 'CONSUMER',
    },
  ],
  BUSINESS_USERS: [
    {
      groupTitle: 'Business users',
      id: 'BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL',
      title: 'Users distribution by risk levels',
      component: RiskLevelBreakdownCard,
      width: 'FULL' as const,
      userType: 'BUSINESS' as const,
      requiredFeatures: ['RISK_SCORING'],
    },
    {
      groupTitle: 'Business users',
      id: 'BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL',
      title: 'Users breakdown by risk levels',
      component: RiskLevelDistributionCard,
      width: 'HALF' as const,
      userType: 'BUSINESS',
      requiredFeatures: ['RISK_SCORING'],
    },
    {
      groupTitle: 'Business users',
      id: 'TOP_BUSINESS_USERS_BY_RULE_HITS',
      title: 'Top users by rule hits',
      component: TopUsersHitCard,
      width: 'HALF' as const,
      userType: 'BUSINESS',
    },
    {
      groupTitle: 'Business users',
      id: 'BUSINESS_USERS_DISTRIBUTION_BY_KYC_STATUS',
      title: 'Users distribution by KYC status',
      component: KYCStatusDistributionCard,
      width: 'HALF' as const,
      userType: 'BUSINESS',
    },
    {
      groupTitle: 'Business users',
      id: 'BUSINESS_USERS_DISTRIBUTION_BY_USER_STATUS',
      title: 'Users distribution by user status',
      component: UserStatusDistributionCard,
      width: 'HALF' as const,
      userType: 'BUSINESS',
    },
  ],

  TRANSACTIONS: [
    {
      groupTitle: 'Transactions',
      id: 'TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION',
      title: 'Transactions breakdown by rule action',
      component: TransactionsChartWidget,
      width: 'FULL',
    },
    {
      groupTitle: 'Transactions',
      id: 'DISTRIBUTION_BY_PAYMENT_METHOD',
      title: 'Distribution by payment method',
      component: PaymentMethodDistributionWidget,
      width: 'HALF',
    },
    {
      groupTitle: 'Transactions',
      id: 'DISTRIBUTION_BY_TRANSACTION_TYPE',
      title: 'Distribution by transaction type',
      component: DistributionByTransactionTypeWidget,
      width: 'HALF',
    },
    {
      groupTitle: 'Transactions',
      id: 'TRANSACTIONS_BREAKDOWN_BY_TRS',
      title: 'Transactions breakdown by TRS',
      component: TransactionTRSChartCard,
      requiredFeatures: ['RISK_SCORING'],
    },
  ],
  RULES: [
    {
      groupTitle: 'Rules',
      id: 'TOP_RULE_HITS_BY_COUNT',
      title: 'Top rule hits by count',
      component: Widget as (props) => JSX.Element,
      children: <RuleHitCard />,
      resizing: 'AUTO' as const,
    },
    {
      groupTitle: 'Rules',
      id: 'DISTRIBUTION_BY_RULE_PRIORITY',
      title: 'Distribution by rule priority',
      component: RulePrioritySplitCard,
      width: 'HALF' as const,
    },
    {
      groupTitle: 'Rules',
      id: 'DISTRIBUTION_BY_RULE_ACTION',
      title: 'Distribution by rule action',
      component: RuleActionSplitCard,
      width: 'HALF' as const,
    },
  ],
  CASE_MANAGEMENT: [
    {
      groupTitle: 'Case management',
      id: 'DISTRIBUTION_BY_CLOSING_REASON',
      title: 'Distribution by closing reason',
      component: CaseClosingReasonCard,
      width: 'HALF',
    },
    {
      groupTitle: 'Case management',
      id: 'DISTRIBUTION_BY_ALERT_PRIORITY',
      title: 'Distribution by open alert priority',
      component: DistributionByAlertPriority,
    },
    {
      groupTitle: 'Case management',
      id: 'DISTRIBUTION_BY_CASE_AND_ALERT_STATUS',
      title: 'Distribution by status',
      component: DistributionByStatus,
    },
  ],
  TEAM_MANAGEMENT: [
    {
      groupTitle: 'Team management',
      id: 'TEAM_OVERVIEW',
      title: 'Team overview',
      component: TeamPerformanceCard,
    },
  ],
};
type DashboardSettings = Record<KeyValues, boolean>;

function Analysis() {
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');
  const i18n = useI18n();

  const [drawerVisible, setDrawerVisible] = useState(false);

  const [dashboardSettings, setDashboardSettings] = useLocalStorageState<DashboardSettings>(
    'DASHBOARD_SETTINGS',
    DEFAULT_VALUES,
  );
  const [updatedState, setUpdatedState] = useState<DashboardSettings>({
    ...DEFAULT_VALUES,
    ...dashboardSettings,
  });

  const settingsToDisplay = useMemo(() => {
    return {
      ...DEFAULT_VALUES,
      ...dashboardSettings,
    };
  }, [dashboardSettings]);

  const renderWidgets = (widgets: WidgetGroup, featureFlags: Record<string, boolean>) => {
    return widgets
      .filter(
        (widget) =>
          (!widget.requiredFeatures ||
            widget.requiredFeatures.every((feature) => featureFlags[feature])) &&
          settingsToDisplay[widget.id],
      )
      .map((widget) => {
        const widgetProps: WidgetProps = {
          ...widget,
          downloadFilenamePrefix: kebabCase(`${widget.userType ?? ''} ${widget.title}`.trim()),
        };

        return {
          props: widgetProps,
          component: widget.component,
        };
      })
      .filter(notEmpty);
  };

  const isWidgetVisible = (widget: WidgetType, featureFlags: Record<string, boolean>) => {
    if (widget.requiredFeatures) {
      return widget.requiredFeatures.every((feature) => featureFlags[feature]);
    }

    return true;
  };

  return (
    <PageWrapper
      title={i18n('menu.dashboard')}
      actionButton={
        <Button
          type="SECONDARY"
          testName={'dashboard-configure-button'}
          icon={<IconSetting />}
          onClick={() => setDrawerVisible(true)}
        >
          Configure
        </Button>
      }
    >
      <WidgetGrid
        groups={Object.keys(WIDGETS).map((groupKey) => ({
          groupTitle: humanizeConstant(groupKey),
          items: renderWidgets(WIDGETS[groupKey], { RISK_SCORING: isRiskScoringEnabled }),
        }))}
      />

      <Drawer
        title="Configure dashboard"
        description="Select chart from below to add it to your dashboard."
        isVisible={drawerVisible}
        onChangeVisibility={(bool) => {
          setDrawerVisible(bool);
        }}
        isClickAwayEnabled
        drawerMaxWidth="500px"
        footer={
          <div style={{ width: '100%' }}>
            <Button
              style={{ width: '100%' }}
              type="PRIMARY"
              onClick={() => {
                setDashboardSettings(() =>
                  Object.keys(WIDGETS).reduce((acc, group) => {
                    WIDGETS[group].forEach((widget: WidgetType) => {
                      acc[widget.id] = updatedState[widget.id];
                    });
                    return acc;
                  }, {} as DashboardSettings),
                );
              }}
              testName="update-dashboard-button"
            >
              Update dashboard
            </Button>
          </div>
        }
      >
        <div className={s.settingsDrawerRoot}>
          {Object.keys(WIDGETS).map((group) => (
            <div className={s.settingsDrawerGroup} key={group}>
              <div className={s.groupTitle}>{humanizeConstant(group)}</div>
              {WIDGETS[group].map((widget: WidgetType) => {
                if (!isWidgetVisible(widget, { RISK_SCORING: isRiskScoringEnabled })) return null;

                return (
                  <Label key={widget.id} label={widget.title} position="RIGHT" level={2}>
                    <Checkbox
                      value={updatedState[widget.id] == null ? true : updatedState[widget.id]}
                      onChange={(value) => {
                        setUpdatedState({
                          ...updatedState,
                          [widget.id]: value,
                        });
                      }}
                      extraLeftLabelMargin
                      testName={widget.id}
                    />
                  </Label>
                );
              })}
            </div>
          ))}
        </div>
      </Drawer>
    </PageWrapper>
  );
}

export default Analysis;
