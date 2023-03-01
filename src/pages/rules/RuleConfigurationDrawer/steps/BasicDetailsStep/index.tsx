import React from 'react';
import StepHeader from '../../StepHeader';
import s from './style.module.less';
import Label from '@/components/library/Label';
import { Priority, Rule, RuleNature } from '@/apis';
import TextInput from '@/components/library/TextInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import { RULE_CASE_PRIORITY } from '@/pages/rules/utils';
import { PropertyListLayout } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/PropertyList';
import InputField from '@/components/library/Form/InputField';

export interface FormValues {
  ruleName: string | undefined;
  ruleDescription: string | undefined;
  ruleNature: RuleNature;
  casePriority: Priority;
}

export const INITIAL_VALUES: FormValues = {
  ruleName: undefined,
  ruleDescription: undefined,
  ruleNature: 'FRAUD',
  casePriority: 'P1',
};

interface Props {
  rule: Rule;
  activeTab: string;
}

export default function BasicDetailsStep(props: Props) {
  const { activeTab } = props;

  return <div className={s.root}>{activeTab === 'rule_details' && <RuleDetails {...props} />}</div>;
}

function RuleDetails(props: Props) {
  const { rule } = props;

  return (
    <>
      <StepHeader title={'Rule details'} description={'Define the basic details for this rule.'} />
      <PropertyListLayout>
        <Label label={'Rule ID'}>{rule.id}</Label>
        <InputField<FormValues>
          name={'ruleName'}
          label={'Rule name'}
          labelProps={{ isOptional: true }}
        >
          {(inputProps) => <TextInput {...inputProps} placeholder={'Enter rule name'} />}
        </InputField>
        <InputField<FormValues>
          name={'ruleDescription'}
          label={'Rule description'}
          labelProps={{ isOptional: true }}
        >
          {(inputProps) => <TextInput {...inputProps} placeholder={'Enter rule description'} />}
        </InputField>
        <InputField<FormValues> name={'ruleNature'} label={'Rule nature'}>
          {(inputProps) => (
            <SelectionGroup<RuleNature>
              mode="SINGLE"
              options={[
                {
                  value: 'FRAUD',
                  label: 'Fraud',
                },
                {
                  value: 'AML',
                  label: 'AML',
                },
              ]}
              {...inputProps}
            />
          )}
        </InputField>
        <InputField<FormValues>
          name={'casePriority'}
          label={'Rule Severity'}
          description={'Define the severity of alerts created when this rule is hit.'}
        >
          {(inputProps) => (
            <SelectionGroup<Priority> mode="SINGLE" options={RULE_CASE_PRIORITY} {...inputProps} />
          )}
        </InputField>
      </PropertyListLayout>
    </>
  );
}
