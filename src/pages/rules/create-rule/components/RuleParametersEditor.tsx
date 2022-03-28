import { Alert, Button, Descriptions, Divider, message, Radio, Row, Space } from 'antd';
import React, { Fragment, useCallback, useState } from 'react';

import { Theme } from '@rjsf/antd';
import { withTheme, IChangeEvent, AjvError } from '@rjsf/core';
import { RULE_ACTION_OPTIONS } from '../../utils';
import styles from './RuleParametersEditor.less';
import { Rule } from '@/apis';
import { RuleAction } from '@/apis/models/RuleAction';
import { useApi } from '@/api';

const JSONSchemaForm = withTheme(Theme);

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
          RuleInstance: {
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
    <>
      <Row justify="center" className={styles.section}>
        <Descriptions column={1} bordered style={{ width: 800 }}>
          <Descriptions.Item label="Rule ID"> {rule.id}</Descriptions.Item>
          <Descriptions.Item label="Rule Name"> {rule.name}</Descriptions.Item>
          <Descriptions.Item label="Rule Description"> {rule.description}</Descriptions.Item>
        </Descriptions>
      </Row>

      <Divider>Rule Parameters</Divider>

      <Row justify="center" className={styles.section}>
        <div>
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
        </div>
      </Row>

      <Divider>Rule Action</Divider>

      <Row justify="center" className={styles.section}>
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
      </Row>

      <Divider />

      <Row justify="end">
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
      </Row>
    </>
  );
};
