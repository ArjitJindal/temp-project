import React from 'react';
import { RuleIsHitWhenStepFormValues } from '../..';
import SubCard from '../SubCard';
import RuleActionSelector from '@/pages/rules/RuleConfigurationDrawer/steps/RuleParametersStep/RuleActionSelector';
import InputField from '@/components/library/Form/InputField';
import { AdvancedOptions } from '@/pages/rules/RuleConfigurationDrawer/steps/RuleParametersStep/AdvancedOptions';

export default function RuleActionsCard() {
  return (
    <SubCard>
      <InputField<RuleIsHitWhenStepFormValues, 'ruleAction'>
        labelProps={{ required: true }}
        name={'ruleAction'}
        label={'Rule actions'}
        description={'Select the action to perform if this rule is hit'}
      >
        {(inputProps) => (
          <>
            <RuleActionSelector {...inputProps} />
            <AdvancedOptions />
          </>
        )}
      </InputField>
    </SubCard>
  );
}
