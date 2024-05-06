import { useState } from 'react';
import s from './style.module.less';
import { Rule, RuleLabels, RuleNature } from '@/apis';
import TextInput from '@/components/library/TextInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import { RULE_LABELS_OPTIONS, RULE_NATURE_OPTIONS } from '@/pages/rules/utils';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import * as Card from '@/components/ui/Card';
import { useFieldState } from '@/components/library/Form/utils/hooks';
import Label from '@/components/library/Label';
import TextArea from '@/components/library/TextArea';

export interface FormValues {
  ruleId: string | undefined;
  ruleName: string | undefined;
  ruleDescription: string | undefined;
  ruleNature: RuleNature;
  ruleLabels: RuleLabels[];
  simulationIterationName?: string;
  simulationIterationDescription?: string;
}

export const INITIAL_VALUES: Partial<FormValues> = {
  ruleName: undefined,
  ruleDescription: undefined,
  ruleNature: undefined,
  ruleLabels: [],
};

interface Props {
  rule?: Rule;
  newRuleId?: string;
  simulationMode?: boolean;
}

export default function BasicDetailsStep(props: Props) {
  const { rule, newRuleId, simulationMode } = props;
  const [ruleNature, setRuleNature] = useState<RuleNature | undefined>(
    rule?.defaultNature ?? INITIAL_VALUES.ruleNature,
  );
  const ruleLabelsValue = useFieldState<FormValues, 'ruleLabels'>('ruleLabels');
  const [ruleLabels, setRuleLabels] = useState<RuleLabels[] | undefined>(
    ruleLabelsValue?.value ?? rule?.labels ?? INITIAL_VALUES.ruleLabels,
  );

  return (
    <div className={s.root}>
      {simulationMode && (
        <Card.Root>
          <Card.Section>
            <SimulationIterationDetails />
          </Card.Section>
        </Card.Root>
      )}
      <Card.Root>
        <Card.Section>
          <PropertyListLayout>
            <InputField<FormValues, 'ruleId'>
              name={'ruleId'}
              label={'Rule ID'}
              labelProps={{ required: true }}
            >
              {(inputProps) => <TextInput {...inputProps} value={newRuleId} isDisabled />}
            </InputField>
            <InputField<FormValues, 'ruleName'>
              name={'ruleName'}
              label={'Rule name'}
              labelProps={{ required: true }}
            >
              {(inputProps) => <TextInput {...inputProps} placeholder={'Enter rule name'} />}
            </InputField>
            <InputField<FormValues, 'ruleDescription'>
              name={'ruleDescription'}
              label={'Rule description'}
              labelProps={{ required: true }}
            >
              {(inputProps) => <TextInput {...inputProps} placeholder={'Enter rule description'} />}
            </InputField>
            <InputField<FormValues, 'ruleNature'>
              name={'ruleNature'}
              label={'Rule nature'}
              labelProps={{ required: true, testId: 'rule-nature' }}
            >
              {(inputProps) => (
                <SelectionGroup<RuleNature>
                  mode="SINGLE"
                  options={RULE_NATURE_OPTIONS}
                  {...inputProps}
                  onChange={(value) => {
                    if (value) {
                      setRuleNature(value);
                      setRuleLabels([]);
                    }
                    if (inputProps.onChange) {
                      inputProps.onChange(value);
                    }
                  }}
                />
              )}
            </InputField>
            <InputField<FormValues, 'ruleLabels'>
              name={'ruleLabels'}
              label={'Rule labels'}
              labelProps={{ required: { value: false, showHint: true } }}
            >
              {(inputProps) => (
                <Select<RuleLabels>
                  options={ruleNature ? RULE_LABELS_OPTIONS[ruleNature] : []}
                  mode="MULTIPLE"
                  {...inputProps}
                  onChange={(value) => {
                    setRuleLabels(value);
                    if (inputProps.onChange) {
                      inputProps.onChange(value);
                    }
                  }}
                  isDisabled={
                    inputProps.isDisabled || (ruleNature == null && inputProps.value?.length === 0)
                  }
                  value={ruleLabels}
                />
              )}
            </InputField>
          </PropertyListLayout>
        </Card.Section>
      </Card.Root>
    </div>
  );
}

function SimulationIterationDetails<
  T extends { simulationIterationName?: string; simulationIterationDescription?: string },
>() {
  return (
    <>
      <Label
        label={'Simulation details'}
        description={'Define the basic details for this simulation iteration'}
      />
      <PropertyListLayout>
        <InputField<T, 'simulationIterationName'>
          name={'simulationIterationName'}
          label={'Iteration name'}
          labelProps={{ required: { value: false, showHint: true } }}
        >
          {(inputProps) => <TextInput {...inputProps} placeholder={'Enter iteration name'} />}
        </InputField>
        <InputField<T, 'simulationIterationDescription'>
          name={'simulationIterationDescription'}
          label={'Description'}
          labelProps={{ required: { value: false, showHint: true } }}
        >
          {(inputProps) => <TextArea {...inputProps} placeholder={'Enter iteration description'} />}
        </InputField>
      </PropertyListLayout>
    </>
  );
}
