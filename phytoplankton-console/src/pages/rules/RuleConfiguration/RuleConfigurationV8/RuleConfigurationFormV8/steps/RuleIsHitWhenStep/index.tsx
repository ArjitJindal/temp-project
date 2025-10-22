import React, { useMemo } from 'react';
import s from './style.module.less';
import {
  CurrencyCode,
  LogicAggregationVariable,
  LogicEntityVariableInUse,
  RiskLevelRuleActions,
  RiskLevelRuleLogic,
  RiskLevelsTriggersOnHit,
  RuleAction,
  RuleMachineLearningVariable,
  RuleType,
  TriggersOnHit,
} from '@/apis';
import { useFieldState } from '@/components/library/Form/utils/hooks';
import DefineLogicCard from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/DefineLogicCard';
import VariableDefinitionCard from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/RuleIsHitWhenStep/VariableDefinitionCard';
import { RuleLogic } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/types';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

export interface RuleIsHitWhenStepFormValues {
  baseCurrency?: CurrencyCode;
  ruleLogic?: RuleLogic;
  riskLevelRuleLogic?: RiskLevelRuleLogic;
  ruleLogicEntityVariables?: LogicEntityVariableInUse[];
  ruleLogicAggregationVariables?: LogicAggregationVariable[];
  ruleLogicMlVariables?: RuleMachineLearningVariable[];
  ruleAction?: RuleAction;
  riskLevelRuleActions?: RiskLevelRuleActions;
  triggersOnHit?: TriggersOnHit;
  riskLevelsTriggersOnHit?: RiskLevelsTriggersOnHit;
}

export const INITIAL_VALUES: Partial<RuleIsHitWhenStepFormValues> = {
  triggersOnHit: {
    usersToCheck: 'ALL',
  },
  riskLevelsTriggersOnHit: {
    VERY_LOW: {
      usersToCheck: 'ALL',
    },
    LOW: {
      usersToCheck: 'ALL',
    },
    MEDIUM: {
      usersToCheck: 'ALL',
    },
    HIGH: {
      usersToCheck: 'ALL',
    },
    VERY_HIGH: {
      usersToCheck: 'ALL',
    },
  },
  ruleAction: 'FLAG',
};

export default function RuleIsHitWhenStep(props: {
  ruleType: RuleType;
  readOnly?: boolean;
  setRuleTypeSelectionStatus: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');

  const aggVariablesFieldState = useFieldState<
    RuleIsHitWhenStepFormValues,
    'ruleLogicAggregationVariables'
  >('ruleLogicAggregationVariables');
  const entityVariablesFieldState = useFieldState<
    RuleIsHitWhenStepFormValues,
    'ruleLogicEntityVariables'
  >('ruleLogicEntityVariables');
  const mlVariablesFieldState = useFieldState<RuleIsHitWhenStepFormValues, 'ruleLogicMlVariables'>(
    'ruleLogicMlVariables',
  );
  const logicFieldState = useFieldState<RuleIsHitWhenStepFormValues, 'ruleLogic'>('ruleLogic');
  const riskLevelsRuleLogicFieldState = useFieldState<
    RuleIsHitWhenStepFormValues,
    'riskLevelRuleLogic'
  >('riskLevelRuleLogic');
  const riskLevelRuleActionsFieldState = useFieldState<
    RuleIsHitWhenStepFormValues,
    'riskLevelRuleActions'
  >('riskLevelRuleActions');
  const baseCurrencyFieldState = useFieldState<RuleIsHitWhenStepFormValues, 'baseCurrency'>(
    'baseCurrency',
  );

  const keys = useUsedVariables(
    isRiskLevelsEnabled ? riskLevelsRuleLogicFieldState.value : logicFieldState.value,
  );

  return (
    <div className={s.root}>
      <VariableDefinitionCard
        usedVariables={keys}
        ruleType={props.ruleType}
        readOnly={props.readOnly}
        entityVariables={entityVariablesFieldState.value}
        aggregationVariables={aggVariablesFieldState.value}
        mlVariables={mlVariablesFieldState.value}
        onChange={(v) => {
          if (v.entityVariables || v.aggregationVariables) {
            props.setRuleTypeSelectionStatus(true);
          }
          if (v.entityVariables?.length === 0 && v.aggregationVariables?.length === 0) {
            props.setRuleTypeSelectionStatus(false);
          }
          if (v.aggregationVariables) {
            aggVariablesFieldState.onChange(v.aggregationVariables);
          }
          if (v.entityVariables) {
            entityVariablesFieldState.onChange(v.entityVariables);
          }
          if (v.mlVariables) {
            mlVariablesFieldState.onChange(v.mlVariables);
          }
        }}
      />
      <DefineLogicCard
        readOnly={props.readOnly}
        ruleType={props.ruleType}
        entityVariablesFieldState={entityVariablesFieldState}
        aggVariablesFieldState={aggVariablesFieldState}
        riskLevelsLogicFieldState={riskLevelsRuleLogicFieldState}
        riskLevelRuleActionsFieldState={riskLevelRuleActionsFieldState}
        logicFieldState={logicFieldState}
        baseCurrencyFieldState={baseCurrencyFieldState}
        mlVariableFieldState={mlVariablesFieldState}
      />
    </div>
  );
}

/*
  Helpers
 */

/**
 * Extracts and returns a list of unique variable keys ("var") used within a provided logic structure.
 *
 * @param {unknown} logic - The input logic structure to traverse and evaluate for variable keys. It can be any nested structure containing objects, arrays, strings, numbers, or booleans.
 * @return {string[]} An array of unique variable keys ("var") found within the provided logic structure.
 */
function useUsedVariables(logic: unknown): string[] {
  return useMemo(() => {
    const varKeys: string[] = [];

    function traverse(value: unknown) {
      if (value == null) {
        return;
      }
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        return;
      }
      if (Array.isArray(value)) {
        for (const element of value) {
          traverse(element);
        }
      }
      if (typeof value === 'object') {
        if ('var' in value && typeof value.var === 'string') {
          if (!varKeys.includes(value.var)) {
            varKeys.push(value.var);
          }
        } else {
          for (const subvalue of Object.values(value)) {
            traverse(subvalue);
          }
        }
      }
    }

    traverse(logic);

    return varKeys;
  }, [logic]);
}
