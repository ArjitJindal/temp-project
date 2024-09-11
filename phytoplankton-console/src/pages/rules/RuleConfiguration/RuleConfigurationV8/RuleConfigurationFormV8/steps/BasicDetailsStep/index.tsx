import { useState } from 'react';
import { RangeValue } from 'rc-picker/es/interface';
import { compact } from 'lodash';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { useLocalStorageState } from 'ahooks';
import s from './style.module.less';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import {
  Rule,
  RuleExecutionMode,
  RuleLabels,
  RuleNature,
  RuleType,
  UserRuleRunCondition,
  UserRuleRunConditionSchedule,
  UserRuleScheduleUnit,
} from '@/apis';
import TextInput from '@/components/library/TextInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import { RULE_LABELS_OPTIONS, RULE_NATURE_OPTIONS, RULE_TYPE_OPTIONS } from '@/pages/rules/utils';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import * as Card from '@/components/ui/Card';
import { useFieldState } from '@/components/library/Form/utils/hooks';
import Label from '@/components/library/Label';
import TextArea from '@/components/library/TextArea';
import DatePicker from '@/components/ui/DatePicker';
import { Dayjs, dayjs } from '@/utils/dayjs';
import NumberInput from '@/components/library/NumberInput';
import { USER_RULE_SCHEDULE_UNITS } from '@/apis/models-custom/UserRuleScheduleUnit';
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';

export interface BasicDetailsFormValues {
  ruleId: string | undefined;
  ruleName: string | undefined;
  ruleDescription: string | undefined;
  ruleNature: RuleNature;
  ruleLabels: RuleLabels[];
  ruleType: RuleType;
  ruleExecutionMode: RuleExecutionMode;
  userRuleRunCondition?: UserRuleRunCondition;
  simulationIterationName?: string;
  simulationIterationDescription?: string;
  simulationIterationTimeRange?: { start: number; end: number };
}

export const INITIAL_VALUES: Partial<BasicDetailsFormValues> = {
  ruleName: undefined,
  ruleDescription: undefined,
  ruleNature: undefined,
  ruleLabels: [],
  ruleType: 'TRANSACTION',
  ruleExecutionMode: 'SYNC',
};
const DEFAULT_USER_RULE_SCHEDULE: UserRuleRunConditionSchedule = {
  value: 1,
  unit: 'WEEK',
};

interface Props {
  rule?: Rule;
  newRuleId?: string;
  simulationMode?: boolean;
  isRuleTypeSet: boolean;
}

export default function BasicDetailsStep(props: Props) {
  const { rule, newRuleId, simulationMode, isRuleTypeSet } = props;
  const [ruleNature, setRuleNature] = useState<RuleNature | undefined>(
    rule?.defaultNature ?? INITIAL_VALUES.ruleNature,
  );
  const ruleLabelsValue = useFieldState<BasicDetailsFormValues, 'ruleLabels'>('ruleLabels');
  const [ruleLabels, setRuleLabels] = useState<RuleLabels[] | undefined>(
    ruleLabelsValue?.value ?? rule?.labels ?? INITIAL_VALUES.ruleLabels,
  );
  const ruleTypeField = useFieldState<BasicDetailsFormValues, 'ruleType'>('ruleType');
  const userRuleRunConditionField = useFieldState<BasicDetailsFormValues, 'userRuleRunCondition'>(
    'userRuleRunCondition',
  );
  const [isSimulationModeEnabled] = useLocalStorageState('SIMULATION_RULES', false);

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
            <InputField<BasicDetailsFormValues, 'ruleId'>
              name={'ruleId'}
              label={'Rule ID'}
              labelProps={{ required: true }}
            >
              {(inputProps) => <TextInput {...inputProps} value={newRuleId} isDisabled />}
            </InputField>
            <InputField<BasicDetailsFormValues, 'ruleName'>
              name={'ruleName'}
              label={'Rule name'}
              labelProps={{ required: true }}
            >
              {(inputProps) => <TextInput {...inputProps} placeholder={'Enter rule name'} />}
            </InputField>
            <InputField<BasicDetailsFormValues, 'ruleDescription'>
              name={'ruleDescription'}
              label={'Rule description'}
              labelProps={{ required: true }}
            >
              {(inputProps) => <TextInput {...inputProps} placeholder={'Enter rule description'} />}
            </InputField>
            <InputField<BasicDetailsFormValues, 'ruleNature'>
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
            <InputField<BasicDetailsFormValues, 'ruleType'>
              name={'ruleType'}
              label={'Rule type'}
              labelProps={{ required: true, testId: 'rule-type' }}
            >
              {(inputProps) => (
                <SelectionGroup<RuleType>
                  mode="SINGLE"
                  optionFixedWidth={425}
                  options={RULE_TYPE_OPTIONS.map((v) => ({ ...v, isDisabled: isRuleTypeSet }))}
                  {...inputProps}
                  isDisabled={isRuleTypeSet}
                  onChange={(value) => {
                    if (inputProps.onChange) {
                      inputProps.onChange(value);
                      if (value === 'USER') {
                        userRuleRunConditionField.onChange({ entityUpdated: true });
                      }
                    }
                  }}
                />
              )}
            </InputField>
            {!isSimulationModeEnabled && (
              <Feature name="ASYNC_RULES">
                <InputField<BasicDetailsFormValues, 'ruleExecutionMode'>
                  name={'ruleExecutionMode'}
                  label={'Rule execution mode'}
                  labelProps={{ required: true }}
                >
                  {(inputProps) => (
                    <SelectionGroup<RuleExecutionMode>
                      mode="SINGLE"
                      options={[
                        {
                          value: 'SYNC',
                          label: 'Synchronous',
                          description:
                            'The rule will run synchronously allowing the rule to be executed in real-time with the transaction',
                        },
                        {
                          value: 'ASYNC',
                          label: 'Asynchronous',
                          description:
                            'The rule will run asynchronously allowing the rule to be executed in the background. This reduces the load on the system and allows for more complex rules to be executed',
                        },
                      ]}
                      {...inputProps}
                    />
                  )}
                </InputField>
              </Feature>
            )}
            {ruleTypeField.value === 'USER' && (
              <PropertyColumns>
                <InputField<BasicDetailsFormValues, 'userRuleRunCondition'>
                  name={'userRuleRunCondition'}
                  label={'Rule is run when'}
                  labelProps={{ required: true, testId: 'rule-is-run-when' }}
                >
                  {(inputProps) => (
                    <SelectionGroup<'ENTITY_UPDATE' | 'SCHEDULE'>
                      mode="MULTIPLE"
                      value={compact([
                        inputProps.value?.entityUpdated ? 'ENTITY_UPDATE' : undefined,
                        inputProps.value?.schedule ? 'SCHEDULE' : undefined,
                      ])}
                      options={[
                        { label: 'User is created/updated', value: 'ENTITY_UPDATE' },
                        { label: 'Periodically', value: 'SCHEDULE' },
                      ]}
                      onChange={(v) => {
                        // NOTE: At least one value should be selected
                        if (!v || v.length === 0) {
                          return;
                        }
                        inputProps.onChange?.({
                          entityUpdated: v.includes('ENTITY_UPDATE'),
                          schedule: v.includes('SCHEDULE')
                            ? inputProps.value?.schedule ?? DEFAULT_USER_RULE_SCHEDULE
                            : undefined,
                        });
                      }}
                    />
                  )}
                </InputField>
                {userRuleRunConditionField.value?.schedule && (
                  <InputField<BasicDetailsFormValues, 'userRuleRunCondition'>
                    name={'userRuleRunCondition'}
                    label={'Select frequency to run the rule (every)'}
                    labelProps={{ required: true }}
                  >
                    {(inputProps) => (
                      <div className={s.scheduleContainer}>
                        <NumberInput
                          min={1}
                          value={inputProps.value?.schedule?.value}
                          onChange={(v) => {
                            if (!inputProps.value || !v) {
                              return;
                            }
                            inputProps.onChange?.({
                              ...inputProps.value,
                              schedule: {
                                value: v,
                                unit: inputProps.value.schedule?.unit ?? 'WEEK',
                              },
                            });
                          }}
                        />
                        <Select<UserRuleScheduleUnit>
                          mode="SINGLE"
                          options={USER_RULE_SCHEDULE_UNITS.map((v) => ({
                            label: humanizeAuto(v),
                            value: v,
                          }))}
                          value={inputProps.value?.schedule?.unit}
                          onChange={(v) => {
                            if (!inputProps.value || !v) {
                              return;
                            }
                            inputProps.onChange?.({
                              ...inputProps.value,
                              schedule: {
                                value: inputProps.value.schedule?.value ?? 1,
                                unit: v,
                              },
                            });
                          }}
                        />
                      </div>
                    )}
                  </InputField>
                )}
              </PropertyColumns>
            )}
            <InputField<BasicDetailsFormValues, 'ruleLabels'>
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
        <InputField<BasicDetailsFormValues, 'simulationIterationTimeRange'>
          name={'simulationIterationTimeRange'}
          label={'Simulation period'}
          description="Run the simulation for the new parameters and compare against the original parameters for the selected time period. All time is considered by default, if not selected."
        >
          {(inputProps) => (
            <DatePicker.RangePicker
              onChange={(value) => {
                inputProps.onChange?.({
                  start: value?.[0]?.valueOf() || 0,
                  end: value?.[1]?.valueOf() || Date.now(),
                });
              }}
              style={{ width: 400 }}
              value={
                [
                  inputProps.value?.start ? dayjs(inputProps.value.start) : undefined,
                  inputProps.value?.end ? dayjs(inputProps.value.end) : undefined,
                ] as RangeValue<Dayjs>
              }
            />
          )}
        </InputField>
      </PropertyListLayout>
    </>
  );
}
