import React from 'react';
import { RuleIsHitWhenStepFormValues } from '../..';
import SubCard from '../SubCard';
import RuleActionSelector from '@/pages/rules/RuleConfigurationDrawer/steps/RuleParametersStep/RuleActionSelector';
import InputField from '@/components/library/Form/InputField';
import { AdvancedOptions } from '@/pages/rules/RuleConfigurationDrawer/steps/RuleParametersStep/AdvancedOptions';
import NestedForm from '@/components/library/Form/NestedForm';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { RiskLevel } from '@/utils/risk-levels';
import { RiskLevelRuleActions } from '@/apis';

interface Props {
  currentRiskLevel: RiskLevel;
}

export default function RuleActionsCard(props: Props) {
  const { currentRiskLevel } = props;
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
        <AdvancedOptions riskLevel={currentRiskLevel} />
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
      <AdvancedOptions />
    </SubCard>
  );
}
