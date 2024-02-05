import { useEffect, useState } from 'react';
import s from './style.module.less';
import { Rule, RuleLabels, RuleNature } from '@/apis';
import TextInput from '@/components/library/TextInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import { RULE_LABELS_OPTIONS, RULE_NATURE_OPTIONS } from '@/pages/rules/utils';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';

export interface FormValues {
  ruleName: string | undefined;
  ruleDescription: string | undefined;
  ruleNature: RuleNature;
  ruleLabels: RuleLabels[];
}

export const INITIAL_VALUES: Partial<FormValues> = {
  ruleName: undefined,
  ruleDescription: undefined,
  ruleNature: undefined,
  ruleLabels: [],
};

interface Props {
  rule?: Rule;
}

export default function BasicDetailsStep(props: Props) {
  const { rule } = props;
  const [ruleNature, setRuleNature] = useState<RuleNature | undefined>(
    rule?.defaultNature ?? INITIAL_VALUES.ruleNature,
  );
  const [ruleLabels, setRuleLabels] = useState<RuleLabels[] | undefined>(rule?.labels);

  useEffect(() => {
    setRuleLabels([]);
  }, [ruleNature]);

  return (
    <div className={s.root}>
      <PropertyListLayout>
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
              isDisabled={inputProps.isDisabled || ruleNature == null}
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
      </PropertyListLayout>
    </div>
  );
}
