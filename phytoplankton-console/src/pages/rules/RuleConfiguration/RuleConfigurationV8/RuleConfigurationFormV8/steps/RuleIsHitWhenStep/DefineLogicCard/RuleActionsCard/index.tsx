import React from 'react';
import { RuleIsHitWhenStepFormValues } from '../../index';
import SubCard from '../SubCard';
import RuleActionSelector from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/RuleActionSelector';
import InputField from '@/components/library/Form/InputField';
import { AdvancedOptions } from '@/pages/rules/RuleConfiguration/RuleConfigurationV2/steps/RuleParametersStep/AdvancedOptions';
import NestedForm from '@/components/library/Form/NestedForm';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RiskLevel } from '@/utils/risk-levels';
import { RiskLevelRuleActions, RuleType } from '@/apis';

interface Props {
  currentRiskLevel: RiskLevel;
  ruleType: RuleType;
}

export default function RuleActionsCard(props: Props) {
  const { currentRiskLevel, ruleType } = props;
  const isRiskLevelsEnabled = useFeatureEnabled('RISK_LEVELS');
  if (isRiskLevelsEnabled) {
    return (
      <SubCard>
        <NestedForm<RuleIsHitWhenStepFormValues> name="riskLevelRuleActions">
          <InputField<RiskLevelRuleActions>
            name={currentRiskLevel}
            labelProps={{ required: true }}
            label={'Rule actions'}
            description={'Select the action to perform if this rule is hit'}
          >
            {(inputProps) => (
              <>
                <RuleActionSelector {...inputProps} />
              </>
            )}
          </InputField>
        </NestedForm>
        <AdvancedOptions riskLevel={currentRiskLevel} ruleType={ruleType} />
      </SubCard>
    );
  }

  return (
    <SubCard>
      <InputField<RuleIsHitWhenStepFormValues, 'ruleAction'>
        name="ruleAction"
        labelProps={{ required: true }}
        label={'Rule actions'}
        description={'Select the action to perform if this rule is hit'}
      >
        {(inputProps) => <RuleActionSelector {...inputProps} />}
      </InputField>
      <AdvancedOptions ruleType={ruleType} />
    </SubCard>
  );
}
