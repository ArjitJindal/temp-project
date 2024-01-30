import ApplyToOtherLevelsCard from 'src/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/DefineLogicCard/ApplyRiskLevels';
import { getAllValuesByKey } from '@flagright/lib/utils';
import React, { useEffect, useMemo, useState } from 'react';
import { CURRENCIES_SELECT_OPTIONS } from '@flagright/lib/constants';
import { RuleIsHitWhenStepFormValues } from '..';
import { RuleLogicBuilder } from '../RuleLogicBuilder';
import { isTransactionAmountVariable } from '../helpers';
import s from './style.module.less';
import RuleActionsCard from './RuleActionsCard';
import IfThen from './IfThen';
import * as Card from '@/components/ui/Card';
import Label from '@/components/library/Label';
import RiskLevelSwitch from '@/components/library/RiskLevelSwitch';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { FieldState } from '@/components/library/Form/utils/hooks';
import { RiskLevel } from '@/utils/risk-levels';
import { RuleLogic } from '@/pages/rules/RuleConfigurationDrawerV8/RuleConfigurationFormV8/types';
import Select from '@/components/library/Select';
import { CurrencyCode } from '@/apis';

const TEMPORALY_DISABLED = false;

interface Props {
  variablesFieldState: FieldState<RuleIsHitWhenStepFormValues['ruleLogicAggregationVariables']>;
  logicFieldState: FieldState<RuleIsHitWhenStepFormValues['ruleLogic']>;
  baseCurrencyFieldState: FieldState<RuleIsHitWhenStepFormValues['baseCurrency']>;
  riskLevelsLogicFieldState: FieldState<RuleIsHitWhenStepFormValues['riskLevelRuleLogic']>;
  riskLevelRuleActionsFieldState: FieldState<RuleIsHitWhenStepFormValues['riskLevelRuleActions']>;
}

export default function DefineLogicCard(props: Props) {
  const {
    variablesFieldState,
    riskLevelsLogicFieldState,
    logicFieldState,
    riskLevelRuleActionsFieldState,
    baseCurrencyFieldState,
  } = props;
  const [currentRiskLevel, setCurrentRiskLevel] = useState<RiskLevel>('VERY_LOW');
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  const jsonLogic = useMemo(() => {
    return isRiskLevelsEnabled
      ? riskLevelsLogicFieldState.value?.[currentRiskLevel]
      : logicFieldState.value;
  }, [
    currentRiskLevel,
    isRiskLevelsEnabled,
    logicFieldState.value,
    riskLevelsLogicFieldState.value,
  ]);
  const hasTransactionAmountVariable = useMemo(() => {
    return Boolean(getAllValuesByKey<string>('var', jsonLogic).find(isTransactionAmountVariable));
  }, [jsonLogic]);
  const settings = useSettings();
  useEffect(() => {
    if (hasTransactionAmountVariable && !baseCurrencyFieldState.value) {
      baseCurrencyFieldState.onChange(settings.defaultValues?.currency);
    }
  }, [baseCurrencyFieldState, hasTransactionAmountVariable, settings.defaultValues?.currency]);

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
        {hasTransactionAmountVariable && (
          // TODO (v8): Base currency design TBD
          <div style={{ maxWidth: 200 }}>
            <Label label="Base currency" required={{ value: true, showHint: true }}>
              <Select
                value={baseCurrencyFieldState.value}
                onChange={(baseCurrency) => {
                  if (baseCurrency) {
                    baseCurrencyFieldState.onChange(baseCurrency as CurrencyCode);
                  }
                }}
                placeholder="Select base currency"
                mode="SINGLE"
                options={CURRENCIES_SELECT_OPTIONS}
              />
            </Label>
          </div>
        )}
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
              entityVariableTypes={['TRANSACTION', 'CONSUMER_USER', 'BUSINESS_USER', 'USER']}
              jsonLogic={jsonLogic}
              aggregationVariables={variablesFieldState.value}
              onChange={(jsonLogic: RuleLogic | undefined) => {
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
