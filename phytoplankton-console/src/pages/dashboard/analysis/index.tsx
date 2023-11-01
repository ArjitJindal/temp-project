import { useMemo, useState } from 'react';
import { useLocalStorageState } from 'ahooks';
import TransactionsChartWidget from './components/TransactionsChartWidget';
import PaymentMethodDistributionWidget from './components/Transactions/PaymentMethodDistributionWidget';
import RuleHitCard from './components/RulesHitCard';
import TopUsersHitCard from './components/TopUsersHitCard';
import RiskLevelDistributionCard from './components/RiskLevelDistributionCard';
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

type KeyValues =
  | 'OVERVIEW'
  | 'TOP_CONSUMER_USERS_BY_RULE_HITS'
  | 'TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION'
  | 'TOP_RULE_HITS_BY_COUNT'
  // | 'CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL'
  | 'CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL'
  | 'CONSUMER_USERS_DISTRIBUTION_BY_USER_STATUS'
  | 'TEAM_OVERVIEW'
  // | 'BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL'
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

const KEYS = {
  OVERVIEW: ['OVERVIEW'],
  CONSUMER_USERS: [
    // 'CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL',
    'CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL',
    'TOP_CONSUMER_USERS_BY_RULE_HITS',
    'CONSUMER_USERS_DISTRIBUTION_BY_KYC_STATUS',
    'CONSUMER_USERS_DISTRIBUTION_BY_USER_STATUS',
  ],
  BUSINESS_USERS: [
    // 'BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL',
    'BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL',
    'TOP_BUSINESS_USERS_BY_RULE_HITS',
    'BUSINESS_USERS_DISTRIBUTION_BY_KYC_STATUS',
    'BUSINESS_USERS_DISTRIBUTION_BY_USER_STATUS',
  ],
  TRANSACTIONS: [
    'TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION',
    'DISTRIBUTION_BY_PAYMENT_METHOD',
    'DISTRIBUTION_BY_TRANSACTION_TYPE',
    'TRANSACTIONS_BREAKDOWN_BY_TRS',
  ],
  RULES: ['TOP_RULE_HITS_BY_COUNT', 'DISTRIBUTION_BY_RULE_PRIORITY', 'DISTRIBUTION_BY_RULE_ACTION'],
  CASE_MANAGEMENT: [
    'DISTRIBUTION_BY_CLOSING_REASON',
    'DISTRIBUTION_BY_ALERT_PRIORITY',
    'DISTRIBUTION_BY_CASE_AND_ALERT_STATUS',
  ],
  TEAM_MANAGEMENT: ['TEAM_OVERVIEW'],
};

const TITLES: { [key in KeyValues]: string } = {
  OVERVIEW: 'Overview',
  TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION: 'Transactions breakdown by rule action',
  TOP_RULE_HITS_BY_COUNT: 'Top rule hits by count',
  TEAM_OVERVIEW: 'Team overview',
  DISTRIBUTION_BY_CLOSING_REASON: 'Distribution by closing reason',
  DISTRIBUTION_BY_ALERT_PRIORITY: 'Distribution by open alert priority',
  DISTRIBUTION_BY_PAYMENT_METHOD: 'Distribution by payment method',
  DISTRIBUTION_BY_TRANSACTION_TYPE: 'Distribution by transaction type',
  TOP_CONSUMER_USERS_BY_RULE_HITS: 'Top consumer users by rule hits',
  TOP_BUSINESS_USERS_BY_RULE_HITS: 'Top business users by rule hits',
  TRANSACTIONS_BREAKDOWN_BY_TRS: 'Transactions breakdown by TRS',
  // CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL: 'Consumer users distribution by risk levels',
  CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL: 'Consumer users breakdown by risk levels',
  BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL: 'Business users breakdown by risk levels',
  // BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL: 'Business users distribution by risk levels',
  DISTRIBUTION_BY_RULE_PRIORITY: 'Distribution by rule priority',
  DISTRIBUTION_BY_RULE_ACTION: 'Distribution by rule action',
  CONSUMER_USERS_DISTRIBUTION_BY_KYC_STATUS: 'Consumer users distribution by KYC status',
  BUSINESS_USERS_DISTRIBUTION_BY_KYC_STATUS: 'Business users distribution by KYC status',
  DISTRIBUTION_BY_CASE_AND_ALERT_STATUS: 'Distribution by status',
  CONSUMER_USERS_DISTRIBUTION_BY_USER_STATUS: 'Consumer users distribution by user status',
  BUSINESS_USERS_DISTRIBUTION_BY_USER_STATUS: 'Business users distribution by user status',
};

const DEFAULT_VALUES = {
  OVERVIEW: true,
  TOP_CONSUMER_USERS_BY_RULE_HITS: true,
  TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION: true,
  TOP_RULE_HITS_BY_COUNT: true,
  // CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL: true,
  CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL: true,
  BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL: true,
  TEAM_OVERVIEW: true,
  DISTRIBUTION_BY_RULE_PRIORITY: true,
  DISTRIBUTION_BY_CLOSING_REASON: true,
  // BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL: true,
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
        groups={[
          {
            groupTitle: 'Overview',
            items: [
              settingsToDisplay.OVERVIEW && {
                props: {
                  id: 'overview',
                },
                component: OverviewCard,
              },
            ].filter(notEmpty),
          },
          {
            groupTitle: 'Consumer users',
            items: [
              // isRiskScoringEnabled &&
              //   settingsToDisplay.CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL && {
              //     props: {
              //       id: 'CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL',
              //       title: TITLES.CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL,
              //       width: 'FULL' as const,
              //       userType: 'CONSUMER',
              //     },
              //     component: RiskLevelBreakdownWidget,
              //   },
              isRiskScoringEnabled &&
                settingsToDisplay.CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL && {
                  props: {
                    id: 'CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL',
                    title: TITLES.CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL,
                    width: 'HALF' as const,
                    userType: 'CONSUMER',
                  },
                  component: RiskLevelDistributionCard,
                },
              settingsToDisplay.TOP_CONSUMER_USERS_BY_RULE_HITS && {
                props: {
                  id: 'top_consumer_users_by_rule_hits',
                  title: TITLES.TOP_CONSUMER_USERS_BY_RULE_HITS,
                  width: 'HALF' as const,
                  userType: 'CONSUMER',
                },
                component: TopUsersHitCard,
              },
              settingsToDisplay.CONSUMER_USERS_DISTRIBUTION_BY_KYC_STATUS && {
                props: {
                  id: 'consumer_users_distribution_by_kyc_status',
                  title: TITLES.CONSUMER_USERS_DISTRIBUTION_BY_KYC_STATUS,
                  width: 'HALF' as const,
                  userType: 'CONSUMER',
                },
                component: KYCStatusDistributionCard,
              },
              settingsToDisplay.CONSUMER_USERS_DISTRIBUTION_BY_USER_STATUS && {
                props: {
                  id: 'user_status_distribution_card',
                  title: TITLES.CONSUMER_USERS_DISTRIBUTION_BY_USER_STATUS,
                  width: 'HALF' as const,
                  userType: 'CONSUMER',
                },
                component: UserStatusDistributionCard,
              },
            ].filter(notEmpty),
          },
          {
            groupTitle: 'Business users',
            items: [
              // isRiskScoringEnabled &&
              //   settingsToDisplay.BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL && {
              //     props: {
              //       id: 'BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL',
              //       title: TITLES.BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL,
              //       width: 'FULL' as const,
              //       userType: 'BUSINESS',
              //     },
              //     component: RiskLevelBreakdownWidget,
              //   },
              isRiskScoringEnabled &&
                settingsToDisplay.BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL && {
                  props: {
                    id: 'BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL',
                    title: TITLES.BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL,
                    width: 'HALF' as const,
                    userType: 'BUSINESS' as const,
                  },
                  component: RiskLevelDistributionCard,
                },
              settingsToDisplay.TOP_BUSINESS_USERS_BY_RULE_HITS && {
                props: {
                  id: 'top_business_users_by_rule_hits',
                  title: TITLES.TOP_BUSINESS_USERS_BY_RULE_HITS,
                  width: 'HALF' as const,
                  userType: 'BUSINESS',
                },
                component: TopUsersHitCard,
              },
              settingsToDisplay.BUSINESS_USERS_DISTRIBUTION_BY_KYC_STATUS && {
                props: {
                  id: 'business_users_distribution_by_kyc_status',
                  title: TITLES.BUSINESS_USERS_DISTRIBUTION_BY_KYC_STATUS,
                  width: 'HALF' as const,
                  userType: 'BUSINESS',
                },
                component: KYCStatusDistributionCard,
              },
              settingsToDisplay.BUSINESS_USERS_DISTRIBUTION_BY_USER_STATUS && {
                props: {
                  id: 'user_status_distribution_card',
                  title: TITLES.BUSINESS_USERS_DISTRIBUTION_BY_USER_STATUS,
                  width: 'HALF' as const,
                  userType: 'BUSINESS',
                },
                component: UserStatusDistributionCard,
              },
            ].filter(notEmpty),
          },
          {
            groupTitle: 'Transactions',
            items: [
              settingsToDisplay.TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION && {
                props: {
                  id: 'transaction_breakdown_by_rule_action',
                  title: TITLES.TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION,
                  width: 'FULL',
                },
                component: TransactionsChartWidget,
              },
              settingsToDisplay.DISTRIBUTION_BY_PAYMENT_METHOD && {
                props: {
                  id: 'distribution_by_payment_method',
                  title: TITLES.DISTRIBUTION_BY_PAYMENT_METHOD,
                  width: 'HALF',
                },
                component: PaymentMethodDistributionWidget,
              },
              settingsToDisplay.DISTRIBUTION_BY_TRANSACTION_TYPE && {
                props: {
                  id: 'distribution_by_transaction_type',
                  title: TITLES.DISTRIBUTION_BY_TRANSACTION_TYPE,
                  width: 'HALF',
                },
                component: DistributionByTransactionTypeWidget,
              },
              isRiskScoringEnabled &&
                settingsToDisplay.TRANSACTIONS_BREAKDOWN_BY_TRS && {
                  props: {
                    id: 'transaction_breakdown_by_trs',
                    title: TITLES.TRANSACTIONS_BREAKDOWN_BY_TRS,
                  },
                  component: TransactionTRSChartCard,
                },
            ].filter(notEmpty),
          },
          {
            groupTitle: 'Rules',
            items: [
              ...(settingsToDisplay.TOP_RULE_HITS_BY_COUNT
                ? [
                    {
                      props: {
                        id: 'top_rule_hits_by_count',
                        // isLegacyComponent: true,
                        title: TITLES.TOP_RULE_HITS_BY_COUNT,
                        children: <RuleHitCard />,
                        resizing: 'AUTO' as const,
                      },
                      component: Widget,
                    },
                  ]
                : []),
              ...(settingsToDisplay.DISTRIBUTION_BY_RULE_PRIORITY
                ? [
                    {
                      props: {
                        id: 'distribution_by_rule_priority',
                        title: TITLES.DISTRIBUTION_BY_RULE_PRIORITY,
                        width: 'HALF' as const,
                      },
                      component: RulePrioritySplitCard,
                    },
                  ]
                : []),
              ...(settingsToDisplay.DISTRIBUTION_BY_RULE_ACTION
                ? [
                    {
                      props: {
                        id: 'distribution_by_rule_action',
                        title: TITLES.DISTRIBUTION_BY_RULE_ACTION,
                        width: 'HALF' as const,
                      },
                      component: RuleActionSplitCard,
                    },
                  ]
                : []),
            ].filter(notEmpty),
          },
          {
            groupTitle: 'Case management',
            items: [
              ...(settingsToDisplay.DISTRIBUTION_BY_CLOSING_REASON
                ? [
                    {
                      props: {
                        id: 'distribution-by-closing reason',
                        title: TITLES.DISTRIBUTION_BY_CLOSING_REASON,
                        width: 'HALF',
                      },
                      component: CaseClosingReasonCard,
                    },
                  ]
                : []),
              ...(settingsToDisplay.DISTRIBUTION_BY_ALERT_PRIORITY
                ? [
                    {
                      props: {
                        id: 'distribution-by-alert-priority',
                        title: TITLES.DISTRIBUTION_BY_ALERT_PRIORITY,
                      },
                      component: DistributionByAlertPriority,
                    },
                  ]
                : []),
              ...(settingsToDisplay.DISTRIBUTION_BY_CASE_AND_ALERT_STATUS
                ? [
                    {
                      props: {
                        id: 'distribution-by-case-and-alert-status',
                        title: TITLES.DISTRIBUTION_BY_CASE_AND_ALERT_STATUS,
                      },
                      component: DistributionByStatus,
                    },
                  ]
                : []),
            ],
          },
          {
            groupTitle: 'Team management',
            items: [
              settingsToDisplay.TEAM_OVERVIEW && {
                props: {
                  id: 'team_performance',
                  title: TITLES.TEAM_OVERVIEW,
                },
                component: TeamPerformanceCard,
              },
            ].filter(notEmpty),
          },
        ]}
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
                  Object.keys(KEYS).reduce((acc, group) => {
                    KEYS[group].forEach((key: KeyValues) => {
                      acc[key] = updatedState[key];
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
          {Object.keys(KEYS).map((group) => (
            <div className={s.settingsDrawerGroup}>
              <div className={s.groupTitle}>{humanizeConstant(group)}</div>
              {KEYS[group].map((key: KeyValues) => (
                <Label
                  key={key}
                  label={TITLES[key] ?? humanizeConstant(key)}
                  position="RIGHT"
                  level={2}
                >
                  <Checkbox
                    value={updatedState[key] == null ? true : updatedState[key]}
                    onChange={(value) => {
                      setUpdatedState({
                        ...updatedState,
                        [key]: value,
                      });
                    }}
                    extraLeftLabelMargin
                    testName={TITLES[key]}
                  />
                </Label>
              ))}
            </div>
          ))}
        </div>
      </Drawer>
    </PageWrapper>
  );
}

export default Analysis;
