import { Descriptions, Divider, Input, message, Radio, Row, Space } from 'antd';
import React, { useCallback, useState } from 'react';

import { AjvError } from '@rjsf/core';
import styles from './style.module.less';
import { CasePriority, CaseType, Rule } from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import { RuleParametersEditor } from '@/components/rules/RuleParametersEditor';
import { RiskLevel } from '@/apis/models/RiskLevel';
import { RiskLevelRuleParameters } from '@/apis/models/RiskLevelRuleParameters';
import { RiskLevelRuleActions } from '@/apis/models/RiskLevelRuleActions';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RULE_CASE_CREATION_TYPE_OPTIONS, RULE_CASE_PRIORITY } from '@/pages/rules/utils';

interface Props {
  rule: Rule;
  onBack: () => void;
  onActivated: () => void;
}

export const RuleConfigurationsEditor: React.FC<Props> = ({ rule, onBack, onActivated }) => {
  const api = useApi();
  const isPulseEnabled = useFeature('PULSE');
  const isCaseCreationTypeEnabled = useFeature('CASE_CREATION_TYPE');
  const [ruleNameAlias, setRuleNameAlias] = useState<string>();
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
  const [casePriority, setCasePriority] = useState(rule.defaultCasePriority);
  const [parameters, setParameters] = useState(rule.defaultParameters);
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
    ) => {
      try {
        setActivating(true);
        await api.postRuleInstances({
          RuleInstance: {
            ruleId: rule.id as string,
            ruleNameAlias,
            parameters,
            riskLevelParameters,
            action,
            riskLevelActions,
            casePriority,
            caseCreationType,
          },
        });
        onActivated();
      } catch (e) {
        message.error('Failed to activate the rule.');
      } finally {
        setActivating(false);
      }
    },
    [api, onActivated, ruleNameAlias],
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
      {isCaseCreationTypeEnabled && (
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
          </Descriptions>
        </Row>
      )}

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
