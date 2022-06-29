import { Descriptions, Divider, message, Row, Space } from 'antd';
import React, { useCallback, useState } from 'react';

import { AjvError } from '@rjsf/core';
import styles from './RuleConfigurationsEditor.less';
import { Rule } from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { useApi } from '@/api';
import Button from '@/components/ui/Button';
import { RuleParametersEditor } from '@/components/rules/RuleParametersEditor';
import { RiskLevel } from '@/apis/models/RiskLevel';
import { RiskLevelRuleParameters } from '@/apis/models/RiskLevelRuleParameters';
import { RiskLevelRuleActions } from '@/apis/models/RiskLevelRuleActions';
import { useFeature } from '@/components/AppWrapper/FeaturesProvider';

interface Props {
  rule: Rule;
  ruleParametersSchema: object;
  onBack: () => void;
  onActivated: () => void;
}

export const RuleConfigurationsEditor: React.FC<Props> = ({
  rule,
  ruleParametersSchema,
  onBack,
  onActivated,
}) => {
  const api = useApi();
  const isPulseEnabled = useFeature('PULSE');
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
  const [parameters, setParameters] = useState(rule.defaultParameters);
  const [riskLevelParameters, setRiskLevelParameters] = useState(
    isPulseEnabled
      ? rule.defaultRiskLevelParameters || {
          VERY_HIGH: {},
          HIGH: {},
          MEDIUM: {},
          LOW: {},
          VERY_LOW: {},
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
    ) => {
      try {
        setActivating(true);
        await api.postRuleInstances({
          RuleInstance: {
            ruleId: rule.id as string,
            parameters,
            riskLevelParameters,
            action,
            riskLevelActions,
          },
        });
        onActivated();
      } catch (e) {
        message.error('Failed to activate the rule.');
      } finally {
        setActivating(false);
      }
    },
    [api, onActivated],
  );

  return (
    <>
      <Row justify="center" className={styles.section}>
        <Descriptions column={1} bordered style={{ width: 800 }}>
          <Descriptions.Item label="Rule ID"> {rule.id}</Descriptions.Item>
          <Descriptions.Item label="Rule Name"> {rule.name}</Descriptions.Item>
          <Descriptions.Item label="Rule Description"> {rule.description}</Descriptions.Item>
        </Descriptions>
      </Row>

      <Divider>Rule Parameters</Divider>
      <Row className={styles.section}>
        <RuleParametersEditor
          parametersSchema={ruleParametersSchema}
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
