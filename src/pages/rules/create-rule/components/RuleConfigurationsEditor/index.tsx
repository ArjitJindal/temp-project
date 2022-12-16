import { Checkbox, Descriptions, Divider, Input, message, Radio, Row, Space } from 'antd';
import React, { useCallback, useState } from 'react';
import { AjvError } from '@rjsf/core';
import styles from './style.module.less';
import { ruleIdsWithAllowedFalsePositiveCheck } from './consts';
import { CasePriority, CaseType, Rule, RuleNature } from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import { RuleParametersEditor } from '@/components/rules/RuleParametersEditor';
import { RiskLevel } from '@/apis/models/RiskLevel';
import { RiskLevelRuleParameters } from '@/apis/models/RiskLevelRuleParameters';
import { RiskLevelRuleActions } from '@/apis/models/RiskLevelRuleActions';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  RULE_CASE_CREATION_TYPE_OPTIONS,
  RULE_CASE_PRIORITY,
  RULE_NATURE_OPTIONS,
} from '@/pages/rules/utils';
import { RuleFiltersEditor } from '@/components/rules/RuleFiltersEditor';

interface Props {
  rule: Rule;
  onBack: () => void;
  onActivated: () => void;
}

export const RuleConfigurationsEditor: React.FC<Props> = ({ rule, onBack, onActivated }) => {
  const api = useApi();
  const isPulseEnabled = useFeature('PULSE');
  const isFalsePositiveCheckEnabled = useFeature('FALSE_POSITIVE_CHECK');
  const [ruleNameAlias, setRuleNameAlias] = useState<string>();
  const [falsePositiveCheckEnabled, setFalsePositiveCheckEnabled] = useState<boolean>(
    rule.defaultFalsePositiveCheckEnabled ?? false,
  );
  const [ruleAction, setRuleAction] = useState<RuleAction>(rule.defaultAction);
  const [riskLevelRuleActions, setRiskLevelRuleActions] = useState(
    isPulseEnabled
      ? rule.defaultRiskLevelActions || {
          VERY_HIGH: rule.defaultAction,
          HIGH: rule.defaultAction,
          MEDIUM: rule.defaultAction,
          LOW: rule.defaultAction,
          VERY_LOW: rule.defaultAction,
        }
      : undefined,
  );
  const [caseCreationType, setCaseCreationType] = useState(rule.defaultCaseCreationType);
  const [nature, setNature] = useState(rule.defaultNature);
  const [casePriority, setCasePriority] = useState(rule.defaultCasePriority);
  const [parameters, setParameters] = useState(rule.defaultParameters);
  const [filters, setFilters] = useState({});
  const [riskLevelParameters, setRiskLevelParameters] = useState(
    isPulseEnabled
      ? rule.defaultRiskLevelParameters || {
          VERY_HIGH: rule.defaultParameters,
          HIGH: rule.defaultParameters,
          MEDIUM: rule.defaultParameters,
          LOW: rule.defaultParameters,
          VERY_LOW: rule.defaultParameters,
        }
      : undefined,
  );
  const [validationErrors, setValidationErrors] = useState<AjvError[]>([]);
  const [activating, setActivating] = useState(false);

  const handleFiltersChange = useCallback((newFilters: object, errors: AjvError[]) => {
    setFilters(newFilters);
    setValidationErrors(errors);
  }, []);
  const handleParametersChange = useCallback((newParameters: object, errors: AjvError[]) => {
    setParameters(newParameters);
    setValidationErrors(errors);
  }, []);
  const handleRiskLevelParametersChange = useCallback(
    (riskLevel: RiskLevel, newParameters: object, errors: AjvError[]) => {
      if (riskLevelParameters) {
        setRiskLevelParameters({
          ...riskLevelParameters,
          [riskLevel]: newParameters,
        });
      }
      setValidationErrors(errors);
    },
    [riskLevelParameters],
  );
  const handleActivateRule = useCallback(
    async (
      rule: Rule,
      action: RuleAction,
      riskLevelActions: RiskLevelRuleActions | undefined,
      parameters: object,
      riskLevelParameters: RiskLevelRuleParameters | undefined,
      casePriority: CasePriority,
      caseCreationType: CaseType,
      falsePositiveCheckEnabled: boolean | undefined,
      nature: RuleNature,
    ) => {
      try {
        setActivating(true);
        await api.postRuleInstances({
          RuleInstance: {
            ruleId: rule.id as string,
            ruleNameAlias,
            filters,
            parameters,
            riskLevelParameters,
            action,
            riskLevelActions,
            casePriority,
            caseCreationType,
            nature,
            falsePositiveCheckEnabled,
          },
        });
        onActivated();
      } catch (e) {
        message.error('Failed to activate the rule.');
      } finally {
        setActivating(false);
      }
    },
    [api, filters, onActivated, ruleNameAlias],
  );

  return (
    <>
      <Row justify="center" className={styles.section}>
        <Descriptions column={1} bordered style={{ width: 800 }}>
          <Descriptions.Item label="Rule ID"> {rule.id}</Descriptions.Item>
          <Descriptions.Item label="Rule Name">
            <Input
              value={ruleNameAlias || rule.name}
              onChange={(event) => setRuleNameAlias(event.target.value)}
            />
          </Descriptions.Item>
          <Descriptions.Item label="Rule Description"> {rule.description}</Descriptions.Item>
        </Descriptions>
      </Row>
      <Row justify="center" className={styles.section}>
        <Descriptions column={1} colon={false} layout="vertical">
          <Descriptions.Item label="Case Creation Type">
            <Radio.Group
              name="caseCreationType"
              options={RULE_CASE_CREATION_TYPE_OPTIONS}
              onChange={(event) => setCaseCreationType(event.target.value)}
              optionType="button"
              value={caseCreationType}
            ></Radio.Group>
          </Descriptions.Item>
          <Descriptions.Item label="Case Priority">
            <Radio.Group
              name="casePriority"
              options={RULE_CASE_PRIORITY}
              onChange={(event) => setCasePriority(event.target.value)}
              optionType="button"
              value={casePriority}
            ></Radio.Group>
          </Descriptions.Item>
          <Descriptions.Item label="Nature">
            <Radio.Group
              name="nature"
              options={RULE_NATURE_OPTIONS}
              onChange={(event) => setNature(event.target.value)}
              optionType="button"
              value={nature}
            ></Radio.Group>
          </Descriptions.Item>
          {isFalsePositiveCheckEnabled && ruleIdsWithAllowedFalsePositiveCheck.includes(rule.id) && (
            <Descriptions.Item label="Enable False Positive Check">
              <Checkbox
                name="falsePositiveCheckEnabled"
                onChange={() => setFalsePositiveCheckEnabled(!falsePositiveCheckEnabled)}
                checked={falsePositiveCheckEnabled}
              ></Checkbox>
            </Descriptions.Item>
          )}
        </Descriptions>
      </Row>
      <Divider>Rule Filters</Divider>
      <Row className={styles.section}>
        <RuleFiltersEditor filters={filters} onChange={handleFiltersChange} />
      </Row>

      <Divider>Rule Parameters</Divider>
      <Row className={styles.section}>
        <RuleParametersEditor
          parametersSchema={rule.parametersSchema}
          parameters={parameters}
          riskLevelParameters={riskLevelParameters}
          action={ruleAction}
          riskLevelActions={riskLevelRuleActions}
          onActionChange={setRuleAction}
          onRiskLevelActionChange={(riskLevel, newAction) =>
            riskLevelRuleActions &&
            setRiskLevelRuleActions({ ...riskLevelRuleActions, [riskLevel]: newAction })
          }
          onParametersChange={handleParametersChange}
          onRiskLevelParametersChange={handleRiskLevelParametersChange}
        />
      </Row>

      <Divider />

      <Row justify="end">
        <Space>
          <Button analyticsName="Back" onClick={onBack}>
            Back
          </Button>
          <Button
            analyticsName="Activate"
            type="primary"
            onClick={() =>
              handleActivateRule(
                rule,
                ruleAction,
                riskLevelRuleActions,
                parameters,
                riskLevelParameters,
                casePriority,
                caseCreationType,
                falsePositiveCheckEnabled,
                nature,
              )
            }
            disabled={validationErrors.length > 0}
            loading={activating}
          >
            Activate
          </Button>
        </Space>
      </Row>
    </>
  );
};
