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
import QaAlertsByRuleHits from './components/Qa/QaAlertsByRuleHits';
import QaOverview from './components/Qa/QaOverview';
import Overview from './components/Overview';
import QaAlertsByAssignee from './components/Qa/QaAlertsByAssignee';
import PageWrapper from '@/components/PageWrapper';
import { useFeatures } from '@/components/AppWrapper/Providers/SettingsProvider';
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
import { Feature } from '@/apis';

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
  | 'TRANSACTIONS_BREAKDOWN_BY_TRS'
  | 'LATEST_TEAM_OVERVIEW'
  | 'QA_ALERTS_BY_RULE_HITS'
  | 'QA_OVERVIEW'
  | 'QA_ALERTS_BY_ASSIGNEE';

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
  LATEST_TEAM_OVERVIEW: true,
  QA_ALERTS_BY_RULE_HITS: true,
  QA_OVERVIEW: true,
  QA_ALERTS_BY_ASSIGNEE: true,
};

type WidgetType = {
  id: string;
  title: string;
  component: (props) => JSX.Element;
  width?: 'FULL' | 'HALF';
  userType?: 'CONSUMER' | 'BUSINESS';
  requiredFeatures?: string[];
  resizing?: 'AUTO';
  children?: React.ReactNode;
};

type WidgetGroup = {
  groupTitle: string;
  items: WidgetType[];
};

interface Widgets {
  OVERVIEW: WidgetGroup;
  CONSUMER_USERS: WidgetGroup;
  BUSINESS_USERS: WidgetGroup;
  TRANSACTIONS: WidgetGroup;
  RULES: WidgetGroup;
  CASE_MANAGEMENT: WidgetGroup;
  TEAM_MANAGEMENT: WidgetGroup;
  QA: WidgetGroup;
}

const WIDGETS: Widgets = {
  OVERVIEW: {
    groupTitle: 'Overview',
    items: [
      {
        id: 'OVERVIEW',
        title: 'Overview',
        component: Overview,
      },
    ],
  },
  CONSUMER_USERS: {
    groupTitle: 'Consumer users',
    items: [
      {
        id: 'CONSUMER_USERS_DISTRIBUTION_BY_RISK_LEVEL',
        title: 'Users distribution by risk levels',
        component: RiskLevelBreakdownCard,
        width: 'FULL',
        userType: 'CONSUMER',
        requiredFeatures: ['RISK_SCORING'],
      },
      {
        id: 'CONSUMER_USERS_BREAKDOWN_BY_RISK_LEVEL',
        title: 'Users breakdown by risk levels',
        component: RiskLevelDistributionCard,
        width: 'HALF',
        userType: 'CONSUMER',
        requiredFeatures: ['RISK_SCORING'],
      },

      {
        id: 'TOP_CONSUMER_USERS_BY_RULE_HITS',
        title: 'Top users by rule hits',
        component: TopUsersHitCard,
        width: 'HALF',
        userType: 'CONSUMER',
      },
      {
        id: 'CONSUMER_USERS_DISTRIBUTION_BY_KYC_STATUS',
        title: 'Users distribution by KYC status',
        component: KYCStatusDistributionCard,
        width: 'HALF',
        userType: 'CONSUMER',
      },
      {
        id: 'CONSUMER_USERS_DISTRIBUTION_BY_USER_STATUS',
        title: 'Users distribution by user status',
        component: UserStatusDistributionCard,
        width: 'HALF',
        userType: 'CONSUMER',
      },
    ],
  },
  BUSINESS_USERS: {
    groupTitle: 'Business users',
    items: [
      {
        id: 'BUSINESS_USERS_DISTRIBUTION_BY_RISK_LEVEL',
        title: 'Users distribution by risk levels',
        component: RiskLevelBreakdownCard,
        width: 'FULL',
        userType: 'BUSINESS',
        requiredFeatures: ['RISK_SCORING'],
      },
      {
        id: 'BUSINESS_USERS_BREAKDOWN_BY_RISK_LEVEL',
        title: 'Users breakdown by risk levels',
        component: RiskLevelDistributionCard,
        width: 'HALF',
        userType: 'BUSINESS',
        requiredFeatures: ['RISK_SCORING'],
      },
      {
        id: 'TOP_BUSINESS_USERS_BY_RULE_HITS',
        title: 'Top users by rule hits',
        component: TopUsersHitCard,
        width: 'HALF',
        userType: 'BUSINESS',
      },
      {
        id: 'BUSINESS_USERS_DISTRIBUTION_BY_KYC_STATUS',
        title: 'Users distribution by KYC status',
        component: KYCStatusDistributionCard,
        width: 'HALF',
        userType: 'BUSINESS',
      },
      {
        id: 'BUSINESS_USERS_DISTRIBUTION_BY_USER_STATUS',
        title: 'Users distribution by user status',
        component: UserStatusDistributionCard,
        width: 'HALF',
        userType: 'BUSINESS',
      },
    ],
  },
  TRANSACTIONS: {
    groupTitle: 'Transactions',
    items: [
      {
        id: 'TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION',
        title: 'Transactions breakdown by rule action',
        component: TransactionsChartWidget,
        width: 'FULL',
      },
      {
        id: 'DISTRIBUTION_BY_PAYMENT_METHOD',
        title: 'Distribution by payment method',
        component: PaymentMethodDistributionWidget,
        width: 'HALF',
      },
      {
        id: 'DISTRIBUTION_BY_TRANSACTION_TYPE',
        title: 'Distribution by transaction type',
        component: DistributionByTransactionTypeWidget,
        width: 'HALF',
      },
      {
        id: 'TRANSACTIONS_BREAKDOWN_BY_TRS',
        title: 'Transactions breakdown by TRS',
        component: TransactionTRSChartCard,
        requiredFeatures: ['RISK_SCORING'],
      },
    ],
  },
  RULES: {
    groupTitle: 'Rules',
    items: [
      {
        id: 'TOP_RULE_HITS_BY_COUNT',
        title: 'Top rule hits by count',
        component: Widget as (props) => JSX.Element,
        children: <RuleHitCard />,
        resizing: 'AUTO',
      },
      {
        id: 'DISTRIBUTION_BY_RULE_PRIORITY',
        title: 'Distribution by rule priority',
        component: RulePrioritySplitCard,
        width: 'HALF',
      },
      {
        id: 'DISTRIBUTION_BY_RULE_ACTION',
        title: 'Distribution by rule action',
        component: RuleActionSplitCard,
        width: 'HALF',
      },
    ],
  },

  CASE_MANAGEMENT: {
    groupTitle: 'Case management',
    items: [
      {
        id: 'DISTRIBUTION_BY_CLOSING_REASON',
        title: 'Distribution by closing reason',
        component: CaseClosingReasonCard,
        width: 'HALF',
      },
      {
        id: 'DISTRIBUTION_BY_ALERT_PRIORITY',
        title: 'Distribution by open alert priority',
        component: DistributionByAlertPriority,
      },
      {
        id: 'DISTRIBUTION_BY_CASE_AND_ALERT_STATUS',
        title: 'Distribution by status',
        component: DistributionByStatus,
      },
    ],
  },

  TEAM_MANAGEMENT: {
    groupTitle: 'Team performance',
    items: [
      {
        id: 'TEAM_OVERVIEW',
        title: 'Team overview',
        component: TeamPerformanceCard,
      },
    ],
  },
  QA: {
    groupTitle: 'QA',
    items: [
      {
        id: 'QA_OVERVIEW',
        title: 'Overview',
        component: QaOverview,
        requiredFeatures: ['QA'],
      },
      {
        id: 'QA_ALERTS_BY_ASSIGNEE',
        title: 'QA’d alerts overview by assignee',
        component: QaAlertsByAssignee,
        requiredFeatures: ['QA'],
      },
      {
        id: 'QA_ALERTS_BY_RULE_HITS',
        title: 'QA’d alerts overview by rule hit',
        component: QaAlertsByRuleHits,
        requiredFeatures: ['QA'],
      },
    ],
  },
};
type DashboardSettings = Record<KeyValues, boolean>;

function Analysis() {
  const features = useFeatures();
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

  const renderWidgets = (widgets: WidgetGroup) => {
    return widgets.items
      .filter(
        (widget) =>
          (!widget.requiredFeatures ||
            widget.requiredFeatures.every((feature) => features.includes(feature as Feature))) &&
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

  const isWidgetVisible = (widget: WidgetType) => {
    if (widget.requiredFeatures) {
      return widget.requiredFeatures.every((feature) => features.includes(feature as Feature));
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
          items: renderWidgets(WIDGETS[groupKey]),
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
                    WIDGETS[group].items.forEach((widget: WidgetType) => {
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
              {WIDGETS[group].items.map((widget: WidgetType) => {
                if (!isWidgetVisible(widget)) return null;

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
