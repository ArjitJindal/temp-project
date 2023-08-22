import { Col, Row } from 'antd';
import { useMemo, useState } from 'react';
import { useLocalStorageState } from 'ahooks';
import TransactionsChartCard from './components/TransactionsChartCard';
import RuleHitCard from './components/RulesHitCard';
import TopUsersHitCard from './components/TopUsersHitCard';
import DRSDistributionCard from './components/DRSDistributionCard';
import TeamPerformanceCard from './components/TeamPerformanceCard';
import OverviewCard from './components/OverviewCard';
import PageWrapper from '@/components/PageWrapper';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useI18n } from '@/locales';
import Button from '@/components/library/Button';
import IconSetting from '@/components/ui/icons/Remix/system/settings-2-line.react.svg';
import Drawer from '@/components/library/Drawer';
import Checkbox from '@/components/library/Checkbox';
import { humanizeConstant } from '@/utils/humanize';

type KeyValues =
  | 'OVERVIEW'
  | 'TOP_USERS_BY_TRANSACTIONS_HITS'
  | 'TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION'
  | 'TOP_RULE_HITS_BY_COUNT'
  | 'USER_DISTIBUTION_BY_CRA_RISK_LEVEL'
  | 'TEAM_OVERVIEW';

const KEYS: KeyValues[] = [
  'OVERVIEW',
  'TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION',
  'TOP_USERS_BY_TRANSACTIONS_HITS',
  'TOP_RULE_HITS_BY_COUNT',
  'USER_DISTIBUTION_BY_CRA_RISK_LEVEL',
  'TEAM_OVERVIEW',
];

const DEFAULT_VALUES = {
  OVERVIEW: true,
  TOP_USERS_BY_TRANSACTIONS_HITS: true,
  TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION: true,
  TOP_RULE_HITS_BY_COUNT: true,
  USER_DISTIBUTION_BY_CRA_RISK_LEVEL: true,
  TEAM_OVERVIEW: true,
};

type DashboardSettings = Record<KeyValues, boolean>;

function Analysis() {
  const isPulseEnabled = useFeatureEnabled('PULSE');
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
        <Button type="SECONDARY" icon={<IconSetting />} onClick={() => setDrawerVisible(true)}>
          Configure
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        {settingsToDisplay.OVERVIEW && (
          <Col span={24}>
            <OverviewCard />
          </Col>
        )}
        {settingsToDisplay.TRANSACTIONS_BREAKDOWN_BY_RULE_ACTION && (
          <Col span={24}>
            <TransactionsChartCard />
          </Col>
        )}
        {settingsToDisplay.TOP_USERS_BY_TRANSACTIONS_HITS && (
          <Col span={24}>
            <TopUsersHitCard />
          </Col>
        )}
        {settingsToDisplay.TOP_RULE_HITS_BY_COUNT && (
          <Col
            span={
              !(isPulseEnabled && settingsToDisplay.USER_DISTIBUTION_BY_CRA_RISK_LEVEL) ? 24 : 14
            }
          >
            <RuleHitCard />
          </Col>
        )}
        {isPulseEnabled && settingsToDisplay.USER_DISTIBUTION_BY_CRA_RISK_LEVEL && (
          <>
            <Col span={!settingsToDisplay.TOP_RULE_HITS_BY_COUNT ? 24 : 10}>
              <DRSDistributionCard />
            </Col>
          </>
        )}
        {settingsToDisplay.TEAM_OVERVIEW && (
          <Col span={24}>
            <TeamPerformanceCard />
          </Col>
        )}
      </Row>
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
                  KEYS.reduce((acc, key) => {
                    acc[key] = updatedState[key];
                    return acc;
                  }, {} as DashboardSettings),
                );
              }}
            >
              Update dashboard
            </Button>
          </div>
        }
      >
        {KEYS.map((key) => (
          <div key={key} style={{ marginBottom: 20 }}>
            <Checkbox
              value={updatedState[key] == null ? true : updatedState[key]}
              label={humanizeConstant(key)}
              onChange={(value) => {
                setUpdatedState({
                  ...updatedState,
                  [key]: value,
                });
              }}
              extraLeftLabelMargin
            />
          </div>
        ))}
      </Drawer>
    </PageWrapper>
  );
}

export default Analysis;
