import { message, Tabs } from 'antd';
import { useLocalStorageState } from 'ahooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import _ from 'lodash';
import { ruleHeaderKeyToDescription } from './utils';
import MyRule from './my-rules';
import { RulesTable } from './RulesTable';
import PageWrapper from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { useI18n } from '@/locales';
import { usePageViewTracker } from '@/utils/tracker';
import RuleConfigurationDrawer, { FormValues } from '@/pages/rules/RuleConfigurationDrawer';
import { Rule, RuleInstance } from '@/apis';
import { getErrorMessage } from '@/utils/lang';
import { useApi } from '@/api';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { removeEmpty } from '@/utils/json';
import { useHasPermissions } from '@/utils/user-utils';

const TableList = () => {
  usePageViewTracker('Rules Page');
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

  useEffect(() => {
    if (!currentRule) {
      setRuleReadOnly(false);
    }
  }, [currentRule]);

  const api = useApi();
  const isPulseEnabled = useFeatureEnabled('PULSE');

  const newInstanceMutation = useMutation<unknown, unknown, FormValues>(
    async (formValues) => {
      if (currentRule == null) {
        throw new Error(`Rule is not selected!`);
      }
      const { basicDetailsStep, standardFiltersStep, ruleParametersStep } = formValues;
      const { ruleAction, ruleParameters, riskLevelParameters, riskLevelActions } =
        ruleParametersStep;
      const payload: RuleInstance = {
        ruleId: currentRule.id as string,
        ruleNameAlias: basicDetailsStep.ruleName,
        ruleDescriptionAlias: basicDetailsStep.ruleDescription,
        filters: standardFiltersStep,
        casePriority: basicDetailsStep.casePriority,
        nature: basicDetailsStep.ruleNature,
        labels: basicDetailsStep.ruleLabels,
        parameters: undefined,
        ...(isPulseEnabled
          ? {
              riskLevelActions: riskLevelActions,
              riskLevelParameters: _.mapValues(riskLevelParameters, removeEmpty),
            }
          : {
              action: ruleAction,
              parameters: removeEmpty(ruleParameters),
            }),
      } as RuleInstance;

      await api.postRuleInstances({
        RuleInstance: payload,
      });
    },
    {
      onSuccess: () => {
        setCurrentRule(null);
        message.success(`Rule instance created!`);
      },
      onError: (err) => {
        console.error(err);
        message.error(`Unable to create rule instance! ${getErrorMessage(err)}`);
      },
    },
  );

  return (
    <PageWrapper
      title={i18n(currentHeaderId as unknown as any)}
      description={currentHeaderDescription}
      actionButton={{
        url: '/rules/request-new',
        title: 'Request New Rule',
      }}
    >
      <PageTabs
        activeKey={rule}
        onChange={(key) => {
          navigate(`/rules/${key}`, { replace: true });
          setCurrentHeaderId(`menu.rules.${key}`);
          setCurrentHeaderDescription(ruleHeaderKeyToDescription(key));
        }}
      >
        <Tabs.TabPane tab="My Rules" key="my-rules">
          <MyRule />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Library" key="rules-library">
          <RulesTable
            onViewRule={(rule) => {
              setCurrentRule(rule);
              setRuleReadOnly(true);
            }}
            onEditRule={(rule) => {
              setCurrentRule(rule);
              setRuleReadOnly(false);
            }}
          />
          <RuleConfigurationDrawer
            rule={currentRule}
            isVisible={currentRule != null}
            isSubmitting={newInstanceMutation.isLoading}
            onChangeVisibility={(isVisible) => {
              if (!isVisible) {
                setCurrentRule(null);
              }
            }}
            onSubmit={(formValues) => {
              newInstanceMutation.mutate(formValues);
            }}
            readOnly={!canWriteRules || ruleReadOnly}
          />
        </Tabs.TabPane>
      </PageTabs>
    </PageWrapper>
  );
};

export default TableList;
