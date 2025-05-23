import { Divider } from 'antd';
import s from './style.module.less';
import { AlertAssignedToInput } from './AlertAssignedToInput/input';
import { RuleQueueInputField } from './RuleQueueInput';
import { AlertInvestigationChecklist } from './AlertInvestigationChecklist';
import CreationIntervalInput, { AlertCreationInterval } from './CreationIntervalInput';
import { FrozenStatusesInput } from './FrozenStatusInput';
import SlaPolicyInput from './SlaPolicyInput';
import { DefaultAlertStatusInput } from './DefaultAlertStatusInput';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import InputField from '@/components/library/Form/InputField';
import {
  AlertCreationDirection,
  DerivedStatus,
  Priority,
  RuleType,
  DefaultAlertStatusForCaseCreation,
} from '@/apis';
import SelectionGroup from '@/components/library/SelectionGroup';
import { AlertCreatedForEnum, RULE_CASE_PRIORITY, getAlertCreatedFor } from '@/pages/rules/utils';
import Select from '@/components/library/Select';
import * as Card from '@/components/ui/Card';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

export interface FormValues {
  alertPriority: Priority;
  alertCreatedFor: AlertCreatedForEnum[];
  alertCreationInterval?: AlertCreationInterval;
  falsePositiveCheckEnabled: 'true' | 'false';
  alertAssigneesType?: 'EMAIL' | 'ROLE';
  alertAssignees?: string[];
  alertAssigneeRole?: string;
  alertCreationDirection?: AlertCreationDirection;
  queueId?: string;
  checklistTemplateId?: string;
  frozenStatuses: DerivedStatus[];
  slaPolicies?: string[];
  defaultAlertStatus?: DefaultAlertStatusForCaseCreation;
}

export const INITIAL_VALUES: Partial<FormValues> = {
  alertPriority: 'P1',
  alertCreatedFor: ['USER'],
  alertCreationInterval: {
    type: 'INSTANTLY',
  },
  falsePositiveCheckEnabled: 'false',
  alertAssigneesType: 'EMAIL',
  frozenStatuses: [],
};

export default function AlertCreationDetailsStep(props: { ruleType: RuleType }) {
  const isSlaEnabled = useFeatureEnabled('ALERT_SLA');
  const settings = useSettings();
  return (
    <Card.Root>
      <Card.Section>
        <div className={s.root}>
          <PropertyListLayout>
            <div className={s.section}>
              <InputField<FormValues, 'alertPriority'>
                name={'alertPriority'}
                label={'Alert severity'}
                description={
                  'Select the severity of the alert when the rule is hit, P1 being the most severe.'
                }
                labelProps={{ required: true }}
              >
                {(inputProps) => (
                  <SelectionGroup<Priority>
                    mode="SINGLE"
                    options={RULE_CASE_PRIORITY}
                    {...inputProps}
                  />
                )}
              </InputField>
              {props.ruleType === 'TRANSACTION' && (
                <>
                  <InputField<FormValues, 'alertCreatedFor'>
                    name={'alertCreatedFor'}
                    label={'Alert created for'}
                    description={`Define whether the alert is created for a ${settings.userAlias} ID or payment identifier such as bank account number, card fingerprint etc.`}
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
                  <InputField<FormValues, 'alertCreationDirection'>
                    name={'alertCreationDirection'}
                    label={'Alert creation direction'}
                    description={
                      'Choose whether alert is created for sender or receiver or automatically based on the rule'
                    }
                    labelProps={{ required: true }}
                  >
                    {(inputProps) => (
                      <Select<AlertCreationDirection>
                        allowClear={false}
                        options={[
                          { value: 'AUTO', label: 'Auto (based on the rule logic)' },
                          {
                            value: 'AUTO_ORIGIN',
                            label: `Auto (based on the rule logic, but only create for origin ${settings.userAlias})`,
                          },
                          {
                            value: 'AUTO_DESTINATION',
                            label: `Auto (based on the rule logic, but only create for destination ${settings.userAlias})`,
                          },
                          { value: 'ORIGIN', label: `Origin ${settings.userAlias}` },
                          { value: 'DESTINATION', label: `Destination ${settings.userAlias}` },
                          {
                            value: 'ALL',
                            label: `Both origin ${settings.userAlias} and destination ${settings.userAlias}`,
                          },
                        ]}
                        {...inputProps}
                        value={inputProps.value ?? 'AUTO'}
                      />
                    )}
                  </InputField>
                </>
              )}
              <InputField<FormValues, 'alertCreationInterval'>
                name={'alertCreationInterval'}
                label={'Alert creation interval'}
                description={'Select the cadence in which the alerts are created.'}
                labelProps={{ element: 'div', required: { value: true, showHint: true } }}
              >
                {(inputProps) => <CreationIntervalInput {...inputProps} />}
              </InputField>
              <InputField<FormValues, 'falsePositiveCheckEnabled'>
                name={'falsePositiveCheckEnabled'}
                label={'False positive check'}
                description={
                  'Calculates the false positive probability for a given alert using machine learning. Learns over time with usage.'
                }
                labelProps={{ required: true }}
              >
                {(inputProps) => (
                  <SelectionGroup<'true' | 'false'>
                    mode="SINGLE"
                    options={[
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' },
                    ]}
                    {...inputProps}
                  />
                )}
              </InputField>
              <DefaultAlertStatusInput />
            </div>
            <Divider className={s.divider} />
            <AlertAssignedToInput />
            {isSlaEnabled && (
              <>
                <Divider className={s.divider} />
                <SlaPolicyInput<FormValues> />
                <Divider className={s.divider} />
              </>
            )}
            <FrozenStatusesInput />
            <Divider className={s.divider} />
            <RuleQueueInputField<FormValues> label="Alert queue" />
            <AlertInvestigationChecklist<FormValues> label="Alert investigation checklist" />
          </PropertyListLayout>
        </div>
      </Card.Section>
    </Card.Root>
  );
}
