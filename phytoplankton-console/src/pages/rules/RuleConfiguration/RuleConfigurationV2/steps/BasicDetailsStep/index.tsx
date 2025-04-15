import { useEffect, useMemo, useState } from 'react';
import { FrozenStatusesInput } from 'src/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/AlertCreationDetailsStep/FrozenStatusInput';
import { RangeValue } from 'rc-picker/es/interface';
import { useLocalStorageState } from 'ahooks';
import { COUNTERPARTY_RULES } from '@flagright/lib/constants';
import StepHeader from '../../StepHeader';
import SlaPolicyInput from '../../../RuleConfigurationV8/RuleConfigurationFormV8/steps/AlertCreationDetailsStep/SlaPolicyInput';
import { DefaultAlertStatusInput } from '../../../RuleConfigurationV8/RuleConfigurationFormV8/steps/AlertCreationDetailsStep/DefaultAlertStatusInput';
import s from './style.module.less';
import Label from '@/components/library/Label';
import {
  DerivedStatus,
  Priority,
  Rule,
  RuleExecutionMode,
  RuleLabels,
  RuleNature,
  RuleInstanceAlertConfigDefaultAlertStatusEnum,
  ScreeningAlertCreationLogic,
} from '@/apis';
import TextInput from '@/components/library/TextInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import {
  AlertCreatedForEnum,
  getAlertCreatedFor,
  RULE_CASE_PRIORITY,
  RULE_LABELS_OPTIONS,
  RULE_NATURE_OPTIONS,
} from '@/pages/rules/utils';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import TextArea from '@/components/library/TextArea';
import Checkbox from '@/components/library/Checkbox';
import {
  Feature,
  useFeatureEnabled,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { RuleQueueInputField } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/AlertCreationDetailsStep/RuleQueueInput';
import CreationIntervalInput, {
  AlertCreationInterval,
} from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/AlertCreationDetailsStep/CreationIntervalInput';
import { AlertAssignedToInput } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/AlertCreationDetailsStep/AlertAssignedToInput/input';
import { AlertInvestigationChecklist } from '@/pages/rules/RuleConfiguration/RuleConfigurationV8/RuleConfigurationFormV8/steps/AlertCreationDetailsStep/AlertInvestigationChecklist';
import DatePicker from '@/components/ui/DatePicker';
import { dayjs, Dayjs } from '@/utils/dayjs';
import Toggle from '@/components/library/Toggle';

export interface FormValues {
  ruleName: string | undefined;
  ruleDescription: string | undefined;
  ruleNature: RuleNature;
  casePriority: Priority;
  ruleLabels: RuleLabels[];
  ruleInstanceId?: string;
  simulationIterationName?: string;
  simulationIterationTimeRange?: { start: number; end: number };
  simulationIterationDescription?: string;
  falsePositiveCheckEnabled?: boolean;
  checklistTemplateId?: string;
  queueId?: string;
  alertAssigneesType?: 'EMAIL' | 'ROLE';
  alertCreationInterval?: AlertCreationInterval;
  alertAssignees?: string[];
  alertAssigneeRole?: string;
  alertCreatedFor: AlertCreatedForEnum[];
  slaPolicies?: string[];
  checksFor: string[];
  frozenStatuses: DerivedStatus[];
  ruleExecutionMode: RuleExecutionMode;
  defaultAlertStatus?: RuleInstanceAlertConfigDefaultAlertStatusEnum;
  alertCreationOnHit?: boolean;
  screeningAlertCreationLogic?: ScreeningAlertCreationLogic;
}

export const INITIAL_VALUES: FormValues = {
  ruleName: undefined,
  ruleDescription: undefined,
  ruleNature: 'FRAUD',
  casePriority: 'P1',
  ruleLabels: [],
  simulationIterationName: 'Iteration 1',
  alertCreationInterval: {
    type: 'INSTANTLY',
  },
  alertAssigneesType: 'EMAIL',
  checksFor: [],
  frozenStatuses: [],
  alertCreatedFor: ['USER'],
  ruleExecutionMode: 'SYNC',
  alertCreationOnHit: true,
  screeningAlertCreationLogic: 'SINGLE_ALERT',
};

interface Props {
  rule: Rule;
  activeTab: string;
}

export default function BasicDetailsStep(props: Props) {
  const { activeTab } = props;
  const component = useMemo(() => {
    if (activeTab === 'rule_details') {
      return <RuleDetails {...props} />;
    } else if (activeTab === 'simulation_details') {
      return <SimulationIterationDetails />;
    } else if (activeTab === 'investigation_checklist') {
      return <ChecklistDetails />;
    } else if (activeTab === 'alert_creation_details') {
      return <AlertCreationDetails {...props} />;
    }
  }, [activeTab, props]);

  return <div className={s.root}>{component}</div>;
}

type ScreeningAlertCreationLogicOption = {
  value: ScreeningAlertCreationLogic;
  label: string;
};

const SCREENING_ALERT_CREATION_LOGICS: ScreeningAlertCreationLogicOption[] = [
  { value: 'SINGLE_ALERT', label: 'Single alert for all counterparties' },
  { value: 'PER_SEARCH_ALERT', label: 'Separate alert for each counterparty' },
];

function RuleDetails(props: Props) {
  const { rule } = props;
  const [ruleNature, setRuleNature] = useState<RuleNature>(rule.defaultNature);
  const [ruleLabels, setRuleLabels] = useState<RuleLabels[]>(rule.labels);
  const isFalsePositiveCheckEnabled = useFeatureEnabled('FALSE_POSITIVE_CHECK');
  useEffect(() => {
    setRuleLabels([]);
  }, [ruleNature]);
  const [isSimulationModeEnabled] = useLocalStorageState('SIMULATION_RULES', false);
  const isPnb = useFeatureEnabled('PNB');
  return (
    <>
      <StepHeader title={'Rule details'} description={'Define the basic details for this rule.'} />
      <PropertyListLayout>
        <Label label={'Rule ID'}>{rule.id}</Label>
        <InputField<FormValues, 'ruleName'>
          name={'ruleName'}
          label={'Rule name'}
          labelProps={{ required: { value: false, showHint: true } }}
        >
          {(inputProps) => <TextInput {...inputProps} placeholder={'Enter rule name'} />}
        </InputField>
        <InputField<FormValues, 'ruleDescription'>
          name={'ruleDescription'}
          label={'Rule description'}
          labelProps={{ required: { value: false, showHint: true } }}
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
        {!isSimulationModeEnabled && (
          <Feature name="ASYNC_RULES">
            <InputField<FormValues, 'ruleExecutionMode'>
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
                      label: 'Real time',
                      description:
                        'The rule executes in real-time after a transaction, ideal for use cases such as blocking high-value transactions and sanction screening.',
                    },
                    {
                      value: 'ASYNC',
                      label: 'Post processing',
                      description:
                        'The rule executes with a delay after a transaction event, reducing system load and enabling complex rule processing.',
                    },
                  ]}
                  {...inputProps}
                />
              )}
            </InputField>
          </Feature>
        )}
        <InputField<FormValues, 'ruleLabels'>
          name={'ruleLabels'}
          label={'Rule labels'}
          labelProps={{ required: { value: false, showHint: true } }}
        >
          {(inputProps) => (
            <Select<RuleLabels>
              options={RULE_LABELS_OPTIONS(isPnb)[ruleNature]}
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

        <Feature name="PNB">
          <InputField<FormValues, 'alertCreationOnHit'>
            name={'alertCreationOnHit'}
            label={'Alert creation on hit'}
            labelProps={{ required: { value: false, showHint: true } }}
          >
            {(inputProps) => (
              <Toggle
                {...inputProps}
                value={inputProps.value ?? true}
                onChange={(value) => {
                  inputProps.onChange?.(value);
                }}
              />
            )}
          </InputField>
        </Feature>

        {rule.defaultFalsePositiveCheckEnabled != null && isFalsePositiveCheckEnabled && (
          <InputField<FormValues, 'falsePositiveCheckEnabled'>
            name={'falsePositiveCheckEnabled'}
            label={'False positive check'}
            labelProps={{ required: { value: false, showHint: true } }}
          >
            {(inputProps) => <Checkbox {...inputProps} value={inputProps.value ?? false} />}
          </InputField>
        )}
        <InputField<FormValues, 'casePriority'>
          name={'casePriority'}
          label={'Rule severity'}
          description={'Define the severity of alerts created when this rule is hit.'}
        >
          {(inputProps) => (
            <SelectionGroup<Priority> mode="SINGLE" options={RULE_CASE_PRIORITY} {...inputProps} />
          )}
        </InputField>
        <RuleQueueInputField<FormValues> />
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
          labelProps={{ required: { value: false, showHint: true } }}
        >
          {(inputProps) => <TextInput {...inputProps} placeholder={'Enter iteration name'} />}
        </InputField>
        <InputField<FormValues, 'simulationIterationDescription'>
          name={'simulationIterationDescription'}
          label={'Description'}
          labelProps={{ required: { value: false, showHint: true } }}
        >
          {(inputProps) => <TextArea {...inputProps} placeholder={'Enter iteration description'} />}
        </InputField>
        <InputField<FormValues, 'simulationIterationTimeRange'>
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

function AlertCreationDetails(props: Props) {
  const { rule } = props;
  const settings = useSettings();
  const isSlaEnabled = useFeatureEnabled('ALERT_SLA');
  return (
    <>
      <StepHeader
        title="Alert creation details"
        description="Define how alerts are created when this rule is hit."
      />
      <PropertyListLayout>
        <InputField<FormValues, 'alertCreationInterval'>
          name={'alertCreationInterval'}
          label={'Alert creation interval'}
          labelProps={{ element: 'div', required: { value: true, showHint: false } }}
        >
          {(inputProps) => <CreationIntervalInput {...inputProps} />}
        </InputField>
        <AlertAssignedToInput />
        <div className={s.alertCreatedFor}>
          <InputField<FormValues, 'alertCreatedFor'>
            name={'alertCreatedFor'}
            label={'Alert created for'}
            labelProps={{ required: true }}
          >
            {(inputProps) => (
              <SelectionGroup<AlertCreatedForEnum>
                mode="MULTIPLE"
                options={getAlertCreatedFor(settings)}
                {...inputProps}
              />
            )}
          </InputField>
          {COUNTERPARTY_RULES.includes(rule.id) && (
            <InputField<FormValues, 'screeningAlertCreationLogic'>
              name={'screeningAlertCreationLogic'}
              label={'Alert creation logic'}
              labelProps={{ required: { value: true, showHint: true } }}
            >
              {(inputProps) => (
                <Select<ScreeningAlertCreationLogic>
                  mode="SINGLE"
                  options={SCREENING_ALERT_CREATION_LOGICS}
                  {...inputProps}
                  className={s.alertCreationLogic}
                  value={inputProps.value ?? 'SINGLE_ALERT'}
                />
              )}
            </InputField>
          )}
        </div>
        <DefaultAlertStatusInput />
        <FrozenStatusesInput />
        {isSlaEnabled && <SlaPolicyInput<FormValues> />}
      </PropertyListLayout>
    </>
  );
}

function ChecklistDetails() {
  return (
    <>
      <StepHeader
        title={'Investigation checklist'}
        description={
          'Set the checklist for analysts to follow during the investigation when this rule is hit.'
        }
      />
      <PropertyListLayout>
        <AlertInvestigationChecklist<FormValues> label="Checklist template" />
      </PropertyListLayout>
    </>
  );
}
