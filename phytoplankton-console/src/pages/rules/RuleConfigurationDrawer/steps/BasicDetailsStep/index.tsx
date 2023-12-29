import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from 'ahooks';
import StepHeader from '../../StepHeader';
import s from './style.module.less';
import CreationIntervalInput, { AlertCreationInterval } from './CreationIntervalInput';
import Label from '@/components/library/Label';
import { ChecklistTemplatesResponse, Priority, Rule, RuleLabels, RuleNature } from '@/apis';
import TextInput from '@/components/library/TextInput';
import SelectionGroup from '@/components/library/SelectionGroup';
import { RULE_CASE_PRIORITY, RULE_LABELS_OPTIONS, RULE_NATURE_OPTIONS } from '@/pages/rules/utils';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import TextArea from '@/components/library/TextArea';
import Checkbox from '@/components/library/Checkbox';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { CHECKLIST_TEMPLATES } from '@/utils/queries/keys';
import { isLoading, isSuccess } from '@/utils/asyncResource';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import { useRuleQueues } from '@/components/rules/util';
import Alert from '@/components/library/Alert';
import { useRoles, useUsers } from '@/utils/user-utils';

export interface FormValues {
  ruleName: string | undefined;
  ruleDescription: string | undefined;
  ruleNature: RuleNature;
  casePriority: Priority;
  ruleLabels: RuleLabels[];
  ruleInstanceId?: string;
  simulationIterationName?: string;
  simulationIterationDescription?: string;
  falsePositiveCheckEnabled?: boolean;
  checklistTemplateId?: string;
  queueId?: string;
  alertAssigneesType?: 'EMAIL' | 'ROLE';
  alertCreationInterval?: AlertCreationInterval;
  alertAssignees?: string[];
  alertAssigneeRole?: string;
  checksFor: string[];
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
    } else if (activeTab === 'checklist_details') {
      return <ChecklistDetails />;
    } else if (activeTab === 'alert_creation_details') {
      return <AlertCreationDetails />;
    }
  }, [activeTab, props]);

  return <div className={s.root}>{component}</div>;
}

function RuleDetails(props: Props) {
  const { rule } = props;
  const [ruleNature, setRuleNature] = useState<RuleNature>(rule.defaultNature);
  const [ruleLabels, setRuleLabels] = useState<RuleLabels[]>(rule.labels);
  const isFalsePositiveCheckEnabled = useFeatureEnabled('FALSE_POSITIVE_CHECK');

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
        <InputField<FormValues, 'ruleLabels'>
          name={'ruleLabels'}
          label={'Rule labels'}
          labelProps={{ required: { value: false, showHint: true } }}
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
        <RuleQueueInputField />
      </PropertyListLayout>
    </>
  );
}

function RuleQueueInputField() {
  const ruleQueues = useRuleQueues();
  const options = useMemo(() => {
    return ruleQueues.map((queue) => ({
      label: queue.name,
      value: queue.id!,
    }));
  }, [ruleQueues]);
  return (
    <InputField<FormValues, 'queueId'> name="queueId" label="Queue">
      {(inputProps) => (
        <Select
          {...inputProps}
          value={options.length ? inputProps.value : undefined}
          options={options}
          mode="SINGLE"
          placeholder="Select queue"
        />
      )}
    </InputField>
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
      </PropertyListLayout>
    </>
  );
}

function AlertCreationDetails() {
  const {
    values: { alertAssigneesType: assigneeTypeSet },
  } = useFormContext<FormValues>();
  const [alertAssigneesType, setAssigneesType] = useState<'EMAIL' | 'ROLE' | ''>(
    assigneeTypeSet ?? '',
  );
  const [users] = useUsers({ includeBlockedUsers: false, includeRootUsers: true });
  const [roles] = useRoles();
  const options = useMemo(() => {
    if (alertAssigneesType === 'EMAIL') {
      return Object.values(users).map((user) => ({ label: user?.email, value: user?.id }));
    } else {
      return roles
        .map((role) => ({ label: role?.name ?? '', value: role?.id ?? '' }))
        .filter((data) => data.label !== '');
    }
  }, [users, roles, alertAssigneesType]);
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
        <InputField<FormValues, 'alertAssigneesType'>
          name={'alertAssigneesType'}
          label={'Alert assigned to'}
          labelProps={{ required: { value: false, showHint: true } }}
        >
          {(inputProps) => {
            return (
              <SelectionGroup<'EMAIL' | 'ROLE'>
                mode="SINGLE"
                options={[
                  { label: 'Account', value: 'EMAIL' },
                  { label: 'Role', value: 'ROLE' },
                ]}
                {...inputProps}
                onChange={(value) => {
                  if (value) {
                    setAssigneesType(value);
                  }
                  if (inputProps.onChange) {
                    inputProps.onChange(value);
                  }
                }}
              />
            );
          }}
        </InputField>
        {alertAssigneesType === 'EMAIL' && (
          <>
            <InputField<FormValues, 'alertAssignees'>
              name={'alertAssignees'}
              label={'Assign to account(s)'}
            >
              {(inputProps) => (
                <Select
                  value={options.length ? inputProps.value : undefined}
                  placeholder={'Select account(s)'}
                  options={options}
                  mode={'MULTIPLE'}
                  {...inputProps}
                />
              )}
            </InputField>
            <Alert type="info">
              Please note if one or more accounts are selected, the alert will be automatically
              assigned and distributed equally.
            </Alert>
          </>
        )}
        {alertAssigneesType === 'ROLE' && (
          <>
            <InputField<FormValues, 'alertAssigneeRole'>
              name={'alertAssigneeRole'}
              label={'Assign to role'}
            >
              {(inputProps) => (
                <Select
                  value={options.length ? inputProps.value : undefined}
                  placeholder={'Select role'}
                  options={options}
                  mode={'SINGLE'}
                  {...inputProps}
                />
              )}
            </InputField>
            <Alert type="info">
              Please note that the alert is automatically assigned and equally distributed among the
              accounts within the role.
            </Alert>
          </>
        )}
      </PropertyListLayout>
    </>
  );
}

function ChecklistDetails() {
  const api = useApi();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, { wait: 500 });

  const params = {
    filterName: debouncedSearchTerm,
  };

  const queryResult = useQuery<ChecklistTemplatesResponse>(CHECKLIST_TEMPLATES(params), async () =>
    api.getChecklistTemplates(params),
  );

  const options = useMemo(() => {
    return isSuccess(queryResult.data)
      ? queryResult.data.value.data
          .filter((checklist) => checklist.status === 'ACTIVE')
          .map((checklist) => ({
            label: checklist.name,
            value: checklist.id!,
          }))
      : [];
  }, [queryResult.data]);

  return (
    <>
      <StepHeader
        title={'Checklist details'}
        description={
          'Set the checklist for analysts to follow during the investigation when this rule is hit.'
        }
      />
      <PropertyListLayout>
        <InputField<FormValues, 'checklistTemplateId'>
          name="checklistTemplateId"
          label="Checklist template"
          data-cy="checklist-template-dropdown"
        >
          {(inputProps) => (
            <Select
              {...inputProps}
              value={options.length ? inputProps.value : undefined}
              options={options}
              mode="SINGLE"
              placeholder="Select checklist template"
              onSearch={setSearchTerm}
              isLoading={isLoading(queryResult.data)}
              isDisabled={isLoading(queryResult.data)}
            />
          )}
        </InputField>
      </PropertyListLayout>
    </>
  );
}
