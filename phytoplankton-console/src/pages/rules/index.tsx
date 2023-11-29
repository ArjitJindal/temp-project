import { useLocalStorageState } from 'ahooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ruleHeaderKeyToDescription } from './utils';
import MyRule from './my-rules';
import { RulesTable } from './RulesTable';
import { SimulationHistoryTable } from './SimulationHistoryTable';
import { PageWrapperContentContainer } from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { useI18n } from '@/locales';
import RuleConfigurationDrawer, {
  RuleConfigurationSimulationDrawer,
} from '@/pages/rules/RuleConfigurationDrawer';
import { Rule } from '@/apis';
import { useHasPermissions } from '@/utils/user-utils';
import { SimulationPageWrapper } from '@/components/SimulationPageWrapper';
import { Authorized } from '@/components/Authorized';

const TableList = () => {
  const { rule = 'rules-library' } = useParams<'rule'>();
  const navigate = useNavigate();
  const [currentHeaderId, setCurrentHeaderId] = useState<string>(`menu.rules.${rule}`);
  const [currentHeaderDescription, setCurrentHeaderDescription] = useState<string>(
    ruleHeaderKeyToDescription(rule),
  );
  const [, setLocalStorageActiveTab] = useLocalStorageState('rule-active-tab', rule);
  const i18n = useI18n();
  const canWriteRules = useHasPermissions(['rules:my-rules:write']);
  useEffect(() => {
    setLocalStorageActiveTab(rule);
  }, [setLocalStorageActiveTab, rule]);

  const [ruleReadOnly, setRuleReadOnly] = useState<boolean>(false);
  const [currentRule, setCurrentRule] = useState<Rule | null>(null);
  const [isSimulationEnabled, setIsSimulationEnabled] = useLocalStorageState<boolean>(
    'SIMULATION_RULES',
    false,
  );

  useEffect(() => {
    if (!currentRule) {
      setRuleReadOnly(false);
    }
  }, [currentRule]);

  return (
    <SimulationPageWrapper
      title={isSimulationEnabled ? 'Simulate rule' : i18n(currentHeaderId as unknown as any)}
      description={
        isSimulationEnabled
          ? 'Test your rule outputs by changing parameters & filters to make better decisions for the actual rule configuration.'
          : currentHeaderDescription
      }
      isSimulationModeEnabled={isSimulationEnabled}
      onSimulationModeChange={setIsSimulationEnabled}
    >
      {isSimulationEnabled ? (
        <PageTabs
          items={[
            {
              title: 'New simulation',
              key: 'new-simulation',
              children: (
                <PageWrapperContentContainer>
                  <PageTabs
                    isPrimary={false}
                    items={[
                      {
                        title: 'My rules',
                        key: 'my-rules',
                        children: (
                          <Authorized required={['simulator:simulations:read']} showForbiddenPage>
                            <MyRule simulationMode={isSimulationEnabled} />
                          </Authorized>
                        ),
                      },
                      {
                        title: 'Library',
                        key: 'rules-library',
                        children: (
                          <Authorized required={['simulator:simulations:read']} showForbiddenPage>
                            <RulesTable
                              simulationMode={isSimulationEnabled}
                              onViewRule={(rule) => {
                                setCurrentRule(rule);
                                setRuleReadOnly(false);
                              }}
                              onEditRule={(rule) => {
                                setCurrentRule(rule);
                                setRuleReadOnly(false);
                              }}
                            />
                          </Authorized>
                        ),
                      },
                    ]}
                  />
                </PageWrapperContentContainer>
              ),
            },
            {
              title: 'Simulation history',
              key: 'simulation-history',
              children: (
                <Authorized required={['simulator:simulations:read']} showForbiddenPage>
                  <SimulationHistoryTable />
                </Authorized>
              ),
            },
          ]}
        />
      ) : (
        <PageTabs
          activeKey={rule}
          onChange={(key) => {
            navigate(`/rules/${key}`, { replace: true });
            setCurrentHeaderId(`menu.rules.${key}`);
            setCurrentHeaderDescription(ruleHeaderKeyToDescription(key));
          }}
          items={[
            {
              title: 'My rules',
              key: 'my-rules',
              children: (
                <PageWrapperContentContainer>
                  <Authorized required={['rules:my-rules:read']}>
                    <MyRule />
                  </Authorized>
                </PageWrapperContentContainer>
              ),
            },
            {
              title: 'Library',
              key: 'rules-library',
              children: (
                <PageWrapperContentContainer>
                  <Authorized required={['rules:library:read']}>
                    <RulesTable
                      onViewRule={(rule) => {
                        setCurrentRule(rule);
                        setRuleReadOnly(false);
                      }}
                      onEditRule={(rule) => {
                        setCurrentRule(rule);
                        setRuleReadOnly(false);
                      }}
                    />
                  </Authorized>
                </PageWrapperContentContainer>
              ),
            },
          ]}
        />
      )}
      {isSimulationEnabled && currentRule ? (
        <RuleConfigurationSimulationDrawer
          rule={currentRule}
          ruleInstance={{
            ruleId: currentRule.id,
            parameters: currentRule.defaultParameters,
            riskLevelParameters: currentRule.defaultRiskLevelParameters,
            action: currentRule.defaultAction,
            riskLevelActions: currentRule.defaultRiskLevelActions,
            nature: currentRule.defaultNature,
            casePriority: currentRule.defaultCasePriority,
            filters: currentRule.defaultFilters,
            labels: [],
            checksFor: currentRule.checksFor,
          }}
          isVisible={currentRule != null}
          onChangeVisibility={(isVisible) => {
            if (!isVisible) {
              setCurrentRule(null);
            }
          }}
          onRuleInstanceUpdated={() => {
            setCurrentRule(null);
          }}
        />
      ) : (
        <RuleConfigurationDrawer
          rule={currentRule}
          isVisible={currentRule != null}
          onChangeVisibility={(isVisible) => {
            if (!isVisible) {
              setCurrentRule(null);
            }
          }}
          onRuleInstanceUpdated={() => setCurrentRule(null)}
          readOnly={!canWriteRules || ruleReadOnly}
          type="CREATE"
          isClickAwayEnabled={ruleReadOnly}
          onChangeToEditMode={() => {
            setRuleReadOnly(false);
          }}
        />
      )}
    </SimulationPageWrapper>
  );
};

export default TableList;
