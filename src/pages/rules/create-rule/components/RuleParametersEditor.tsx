import { Alert, Button, Descriptions, Divider, message, Radio, Space } from 'antd';
import React, { Fragment, useCallback, useState } from 'react';

import { Theme } from '@rjsf/antd';
import { withTheme, IChangeEvent, AjvError } from '@rjsf/core';
import { Rule } from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { useApi } from '@/api';

const JSONSchemaForm = withTheme(Theme);

const RULE_ACTION_OPTIONS = [
  { label: 'Flag', value: RuleAction.Flag },
  { label: 'Block', value: RuleAction.Block },
  { label: 'Whitelist', value: RuleAction.Whitelist },
];

interface Props {
  rule: Rule;
  onBack: () => void;
  onActivated: () => void;
}

export const RuleParametersEditor: React.FC<Props> = ({ rule, onBack, onActivated }) => {
  const api = useApi();
  const [ruleAction, setRuleAction] = useState<RuleAction>(rule.defaultAction);
  const [parameters, setParameters] = useState(rule.defaultParameters);
  const [validationErrors, setValidationErrors] = useState<AjvError[]>([]);
  const [activating, setActivating] = useState(false);

  const handleParametersChange = useCallback((event: IChangeEvent) => {
    setParameters(event.formData);
    setValidationErrors(event.errors);
  }, []);
  const handleActivateRule = useCallback(
    async (rule: Rule, action: RuleAction, parameters: object) => {
      try {
        setActivating(true);
        await api.postRuleInstances({
          ruleInstance: {
            ruleId: rule.id as string,
            parameters,
            action,
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
    <div>
      <Descriptions column={1} bordered>
        <Descriptions.Item label="Rule ID"> {rule.id}</Descriptions.Item>
        <Descriptions.Item label="Rule Name"> {rule.name}</Descriptions.Item>
        <Descriptions.Item label="Rule Description"> {rule.description}</Descriptions.Item>
      </Descriptions>

      <Divider />

      <h3>Rule Parameters: </h3>
      <Alert
        closable
        showIcon
        message="Thresholds are set to default values, update them to match your risk appetite"
        style={{ marginBottom: 24 }}
      />
      <JSONSchemaForm
        schema={rule.parametersSchema}
        formData={parameters}
        onChange={handleParametersChange}
        liveValidate
      >
        {/* Add a dummy fragment for disabling the submit button */}
        <Fragment />
      </JSONSchemaForm>

      <Divider />

      <h3>Rule Action: </h3>

      <Radio.Group
        options={RULE_ACTION_OPTIONS}
        onChange={(e) => {
          setRuleAction(e.target.value);
        }}
        value={ruleAction}
        optionType="button"
        buttonStyle="solid"
        style={{ margin: '0px auto', width: '100%', textAlign: 'center' }}
        size="large"
      />

      <Space>
        <Button onClick={onBack}>Back</Button>
        <Button
          type="primary"
          danger
          onClick={() => handleActivateRule(rule, ruleAction, parameters)}
          disabled={validationErrors.length > 0}
          loading={activating}
        >
          Activate
        </Button>
      </Space>
    </div>
  );
};
