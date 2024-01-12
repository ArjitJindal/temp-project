import ApplyToOtherLevelsCard from 'src/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/DefineLogicCard/ApplyRiskLevels';
import React, { useState } from 'react';
import { RuleIsHitWhenStepFormValues } from '..';
import { RuleLogicBuilder } from '../RuleLogicBuilder';
import s from './style.module.less';
import RuleActionsCard from './RuleActionsCard';
import IfThen from './IfThen';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { FieldState } from '@/components/library/Form/utils/hooks';
import { RiskLevel } from '@/utils/risk-levels';

const TEMPORALY_DISABLED = false;

interface Props {
  variablesFieldState: FieldState<RuleIsHitWhenStepFormValues['ruleLogicAggregationVariables']>;
  logicFieldState: FieldState<RuleIsHitWhenStepFormValues['ruleLogic']>;
  riskLevelsLogicFieldState: FieldState<RuleIsHitWhenStepFormValues['riskLevelRuleLogic']>;
  riskLevelRuleActionsFieldState: FieldState<RuleIsHitWhenStepFormValues['riskLevelRuleActions']>;
}

export default function DefineLogicCard(props: Props) {
  const {
    variablesFieldState,
    riskLevelsLogicFieldState,
    logicFieldState,
    riskLevelRuleActionsFieldState,
  } = props;
  const [currentRiskLevel, setCurrentRiskLevel] = useState<RiskLevel>('VERY_LOW');
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  return (
    <Card.Root>
      <Card.Section>
        <div className={s.cardHeader}>
          <Label
            required={true}
            label={'Rule logic'}
            description={
              'Using the above defined variables create a rule logic using operators for the rule to execute'
            }
          />
        </div>
      </Card.Section>
      <Card.Section>
        {isRiskLevelsEnabled && !TEMPORALY_DISABLED && (
          <RiskLevelSwitch
            value={currentRiskLevel}
            onChange={(riskLevel) => {
              if (riskLevel) {
                setCurrentRiskLevel(riskLevel);
              }
            }}
          />
        )}
        <IfThen
          renderIf={
            <RuleLogicBuilder
              key={currentRiskLevel}
              entityVariableTypes={['TRANSACTION', 'CONSUMER_USER', 'BUSINESS_USER']}
              jsonLogic={
                isRiskLevelsEnabled
                  ? riskLevelsLogicFieldState.value?.[currentRiskLevel]
                  : logicFieldState.value
              }
              aggregationVariables={variablesFieldState.value}
              onChange={(jsonLogic) => {
                if (isRiskLevelsEnabled) {
                  riskLevelsLogicFieldState.onChange({
                    ...(riskLevelsLogicFieldState.value ?? {
                      VERY_HIGH: {},
                      HIGH: {},
                      MEDIUM: {},
                      LOW: {},
                      VERY_LOW: {},
                    }),
                    [currentRiskLevel]: jsonLogic,
                  });
                } else {
                  logicFieldState.onChange(jsonLogic);
                }
              }}
            />
          }
          renderThen={
            <div className={s.root}>
              <RuleActionsCard currentRiskLevel={currentRiskLevel} />
              {isRiskLevelsEnabled && (
                <ApplyToOtherLevelsCard
                  currentRiskLevel={currentRiskLevel}
                  onConfirm={(chosenLevels) => {
                    // Update logic for chosen risk levels
                    riskLevelsLogicFieldState.onChange((prevState) => {
                      return chosenLevels.reduce(
                        (acc, riskLevel) => ({
                          ...acc,
                          [riskLevel]: prevState?.[currentRiskLevel],
                        }),
                        {
                          VERY_HIGH: undefined,
                          HIGH: undefined,
                          MEDIUM: undefined,
                          LOW: undefined,
                          VERY_LOW: undefined,
                          ...prevState,
                        },
                      );
                    });

                    // Update risk level actions
                    riskLevelRuleActionsFieldState.onChange((prevState) => {
                      return chosenLevels.reduce(
                        (acc, riskLevel) => ({
                          ...acc,
                          [riskLevel]: prevState?.[currentRiskLevel],
                        }),
                        {
                          VERY_HIGH: 'FLAG',
                          HIGH: 'FLAG',
                          MEDIUM: 'FLAG',
                          LOW: 'FLAG',
                          VERY_LOW: 'FLAG',
                          ...prevState,
                        },
                      );
                    });
                  }}
                />
              )}
            </div>
          }
        />
      </Card.Section>
    </Card.Root>
  );
}
