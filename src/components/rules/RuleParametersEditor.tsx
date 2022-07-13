import { Theme } from '@rjsf/antd';
import { AjvError, IChangeEvent, withTheme } from '@rjsf/core';
import { Radio, Tabs, Typography } from 'antd';
import { Fragment, useCallback, useState } from 'react';
import _ from 'lodash';
import { useLocalStorageState } from 'ahooks';
import { RuleActionTag } from './RuleActionTag';
import { RiskLevel } from '@/apis/models/RiskLevel';
import { RULE_ACTION_OPTIONS } from '@/pages/rules/utils';
import { RiskLevelRuleActions, RuleAction } from '@/apis';
import { useFeature } from '@/components/AppWrapper/Providers/FeaturesProvider';

const JSONSchemaForm = withTheme(Theme);

const RISK_LEVELS: RiskLevel[] = ['VERY_HIGH', 'HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'];

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
        onParametersChange(event.formData, event.errors);
      }
    },
    [onParametersChange],
  );
  const handleRiskLevelParametersChange = useCallback(
    (riskLevel: RiskLevel, event: IChangeEvent) => {
      if (onRiskLevelParametersChange) {
        onRiskLevelParametersChange(riskLevel, event.formData, event.errors);
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

  return (
    <div>
      {isPulseEnabled ? (
        <Tabs activeKey={activeTab} type="line" onChange={handleChangeActiveRiskLevel}>
          {RISK_LEVELS.map((riskLevel) => (
            <Tabs.TabPane tab={riskLevelToLabel(riskLevel)} key={riskLevel}>
              <JSONSchemaForm
                schema={parametersSchema}
                formData={riskLevelParameters?.[riskLevel] || {}}
                onChange={(event) => handleRiskLevelParametersChange(riskLevel, event)}
                readonly={readonly}
                liveValidate
              >
                {/* Add a dummy fragment for disabling the submit button */}
                <Fragment />
              </JSONSchemaForm>
            </Tabs.TabPane>
          ))}
        </Tabs>
      ) : (
        <JSONSchemaForm
          schema={parametersSchema}
          formData={parameters}
          onChange={handleParametersChange}
          readonly={readonly}
          liveValidate
        >
          {/* Add a dummy fragment for disabling the submit button */}
          <Fragment />
        </JSONSchemaForm>
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
          action={isPulseEnabled && riskLevelActions ? riskLevelActions[activeRiskLevel] : action}
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
