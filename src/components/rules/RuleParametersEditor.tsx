import { AjvError, IChangeEvent } from '@rjsf/core';
import { Radio, Tabs, Typography } from 'antd';
import { Fragment, useCallback, useState } from 'react';
import _ from 'lodash';
import { useLocalStorageState } from 'ahooks';
import { JsonSchemaForm } from '../JsonSchemaForm';
import { RuleActionTag } from './RuleActionTag';
import styles from './RuleParametersEditor.module.less';
import { RiskLevel } from '@/apis/models/RiskLevel';
import { RULE_ACTION_OPTIONS } from '@/pages/rules/utils';
import { RiskLevelRuleActions, RuleAction } from '@/apis';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';

const RISK_LEVELS: RiskLevel[] = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'];

function getFixedSchema(schema: object) {
  return _.cloneDeepWith(schema, (value) => {
    /**
     * antd theme doesn't allow clearing the selected enum even the field is nullable.
     * In this case, we concat the "empty" option and it'll be removed by removeNil
     * to be a truly nullable field
     */
    if (value?.enum && value?.type === 'string' && value?.nullable) {
      return {
        ...value,
        enum: [''].concat(value.enum),
      };
    }
  });
}

function removeNil(formData: object) {
  return JSON.parse(
    JSON.stringify(formData, (k, v) => {
      if (v === null) {
        return undefined;
      }
      return v;
    }),
  );
}

function riskLevelToLabel(riskLevel: RiskLevel) {
  return `${_.capitalize(riskLevel.replace('_', ' '))} risk`;
}
interface Props {
  parametersSchema: object;
  parameters: object;
  riskLevelParameters?: object;
  action: RuleAction;
  riskLevelActions?: RiskLevelRuleActions;
  onParametersChange: (newParameters: object, errors: AjvError[]) => void;
  onRiskLevelParametersChange?: (
    riskLevel: RiskLevel,
    newParameters: object,
    errors: AjvError[],
  ) => void;
  onActionChange: (newAction: RuleAction) => void;
  onRiskLevelActionChange?: (riskLevel: RiskLevel, newAction: RuleAction) => void;
  readonly?: boolean;
}

export const RuleParametersEditor: React.FC<Props> = ({
  action,
  riskLevelActions,
  parametersSchema,
  parameters,
  riskLevelParameters,
  readonly,
  onActionChange,
  onRiskLevelActionChange,
  onParametersChange,
  onRiskLevelParametersChange,
}) => {
  const isPulseEnabled = useFeature('PULSE');
  const [activeRiskLevel, setActiveRiskLevel] = useState<RiskLevel>('VERY_HIGH');
  const handleParametersChange = useCallback(
    (event: IChangeEvent) => {
      if (onParametersChange) {
        onParametersChange(removeNil(event.formData), event.errors);
      }
    },
    [onParametersChange],
  );
  const handleRiskLevelParametersChange = useCallback(
    (riskLevel: RiskLevel, event: IChangeEvent) => {
      if (onRiskLevelParametersChange) {
        onRiskLevelParametersChange(riskLevel, removeNil(event.formData), event.errors);
      }
    },
    [onRiskLevelParametersChange],
  );
  const [activeTab, setActiveTab] = useLocalStorageState('pulse-active-tab', 'VERY_HIGH');
  const handleChangeActiveRiskLevel = useCallback(
    (riskLevel: string) => {
      setActiveRiskLevel(riskLevel as RiskLevel);
      setActiveTab(riskLevel);
    },
    [setActiveTab],
  );

  const uiSchema = parametersSchema['ui:schema'];
  return (
    <div className={styles.RuleParametersEditor}>
      {isPulseEnabled ? (
        <Tabs activeKey={activeTab} type="line" onChange={handleChangeActiveRiskLevel}>
          {RISK_LEVELS.map((riskLevel) => (
            <Tabs.TabPane tab={riskLevelToLabel(riskLevel)} key={riskLevel}>
              <JsonSchemaForm
                schema={getFixedSchema(parametersSchema)}
                formData={riskLevelParameters?.[riskLevel] || {}}
                onChange={(event) => handleRiskLevelParametersChange(riskLevel, event)}
                readonly={readonly}
                liveValidate
                uiSchema={uiSchema}
              >
                {/* Add a dummy fragment for disabling the submit button */}
                <Fragment />
              </JsonSchemaForm>
            </Tabs.TabPane>
          ))}
        </Tabs>
      ) : (
        <JsonSchemaForm
          schema={getFixedSchema(parametersSchema)}
          formData={parameters}
          onChange={handleParametersChange}
          readonly={readonly}
          liveValidate
          uiSchema={uiSchema}
        >
          {/* Add a dummy fragment for disabling the submit button */}
          <Fragment />
        </JsonSchemaForm>
      )}

      <div style={{ paddingBottom: 10 }}>
        <Typography.Text strong>
          {readonly
            ? `Action${isPulseEnabled ? ` (${riskLevelToLabel(activeRiskLevel)})` : ''}:`
            : `Select a Rule Action ${
                isPulseEnabled ? `for ${riskLevelToLabel(activeRiskLevel)}` : ''
              }`}
        </Typography.Text>
      </div>

      {readonly ? (
        <RuleActionTag
          ruleAction={
            isPulseEnabled && riskLevelActions ? riskLevelActions[activeRiskLevel] : action
          }
        />
      ) : (
        <Radio.Group
          options={RULE_ACTION_OPTIONS}
          onChange={(e) => {
            const newAction = e.target.value as RuleAction;
            if (isPulseEnabled && onRiskLevelActionChange) {
              onRiskLevelActionChange(activeRiskLevel, newAction);
            } else {
              onActionChange(newAction);
            }
          }}
          value={isPulseEnabled && riskLevelActions ? riskLevelActions[activeRiskLevel] : action}
          optionType="button"
          buttonStyle="solid"
          size="large"
        />
      )}
    </div>
  );
};
