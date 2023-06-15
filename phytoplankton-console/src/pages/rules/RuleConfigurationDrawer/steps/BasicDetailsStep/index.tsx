import { useEffect, useState } from 'react';
import StepHeader from '../../StepHeader';
import s from './style.module.less';
import Label from '@/components/library/Label';
import { Priority, Rule, RuleLabels, RuleNature } from '@/apis';
import TextInput from '@/components/library/TextInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import { RULE_CASE_PRIORITY, RULE_LABELS_OPTIONS, RULE_NATURE_OPTIONS } from '@/pages/rules/utils';
import { PropertyListLayout } from '@/pages/rules/RuleConfigurationDrawer/JsonSchemaEditor/PropertyList';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import TextArea from '@/components/library/TextArea';

export interface FormValues {
  ruleName: string | undefined;
  ruleDescription: string | undefined;
  ruleNature: RuleNature;
  casePriority: Priority;
  ruleLabels: RuleLabels[];
  ruleInstanceId?: string;
  simulationIterationName?: string;
  simulationIterationDescription?: string;
}

export const INITIAL_VALUES: FormValues = {
  ruleName: undefined,
  ruleDescription: undefined,
  ruleNature: 'FRAUD',
  casePriority: 'P1',
  ruleLabels: [],
  simulationIterationName: 'Iteration 1',
};

interface Props {
  rule: Rule;
  activeTab: string;
}

export default function BasicDetailsStep(props: Props) {
  const { activeTab } = props;

  return (
    <div className={s.root}>
      {activeTab === 'rule_details' ? <RuleDetails {...props} /> : <SimulationIterationDetails />}
    </div>
  );
}

function RuleDetails(props: Props) {
  const { rule } = props;
  const [ruleNature, setRuleNature] = useState<RuleNature>(rule.defaultNature);
  const [ruleLabels, setRuleLabels] = useState<RuleLabels[]>(rule.labels);

  useEffect(() => {
    setRuleLabels([]);
  }, [ruleNature]);

  return (
    <>
      <StepHeader title={'Rule details'} description={'Define the basic details for this rule.'} />
      <PropertyListLayout>
        <Label label={'Rule ID'}>{rule.id}</Label>
        <InputField<FormValues, 'ruleName'>
          name={'ruleName'}
          label={'Rule name'}
          labelProps={{ isOptional: true }}
        >
          {(inputProps) => <TextInput {...inputProps} placeholder={'Enter rule name'} />}
        </InputField>
        <InputField<FormValues, 'ruleDescription'>
          name={'ruleDescription'}
          label={'Rule description'}
          labelProps={{ isOptional: true }}
        >
          {(inputProps) => <TextInput {...inputProps} placeholder={'Enter rule description'} />}
        </InputField>
        <InputField<FormValues, 'ruleNature'> name={'ruleNature'} label={'Rule nature'}>
          {(inputProps) => {
            return (
              <SelectionGroup<RuleNature>
                mode="SINGLE"
                options={RULE_NATURE_OPTIONS}
                {...inputProps}
                onChange={(value) => {
                  if (value) {
                    setRuleNature(value);
                  }
                  if (inputProps.onChange) {
                    inputProps.onChange(value);
                  }
                }}
              />
            );
          }}
        </InputField>
        <InputField<FormValues, 'ruleLabels'>
          name={'ruleLabels'}
          label={'Rule labels'}
          labelProps={{ isOptional: true }}
        >
          {(inputProps) => (
            <Select<RuleLabels>
              options={RULE_LABELS_OPTIONS[ruleNature]}
              mode="MULTIPLE"
              {...inputProps}
              onChange={(value) => {
                if (value) {
                  setRuleLabels(value);
                }
                if (inputProps.onChange) {
                  inputProps.onChange(value);
                }
              }}
              value={ruleLabels}
            />
          )}
        </InputField>

        <InputField<FormValues, 'casePriority'>
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

function SimulationIterationDetails() {
  return (
    <>
      <StepHeader
        title={'Simulation details'}
        description={'Define the basic details for this simulation iteration.'}
      />
      <PropertyListLayout>
        <InputField<FormValues, 'simulationIterationName'>
          name={'simulationIterationName'}
          label={'Iteration name'}
          labelProps={{ isOptional: true }}
        >
          {(inputProps) => <TextInput {...inputProps} placeholder={'Enter iteration name'} />}
        </InputField>
        <InputField<FormValues, 'simulationIterationDescription'>
          name={'simulationIterationDescription'}
          label={'Description'}
          labelProps={{ isOptional: true }}
        >
          {(inputProps) => <TextArea {...inputProps} placeholder={'Enter iteration description'} />}
        </InputField>
      </PropertyListLayout>
    </>
  );
}
