import { Divider } from 'antd';
import s from './style.module.less';
import { AlertAssignedToInput } from './AlertAssignedToInput/input';
import { RuleQueueInputField } from './RuleQueueInput';
import { AlertInvestigationChecklist } from './AlertInvestigationChecklist';
import CreationIntervalInput, { AlertCreationInterval } from './CreationIntervalInput';
import { FrozenStatusesInput } from './FrozenStatusInput';
import SlaPolicyInput from './SlaPolicyInput';
import { PropertyListLayout } from '@/components/library/JsonSchemaEditor/PropertyList';
import InputField from '@/components/library/Form/InputField';
import { AlertCreationDirection, DerivedStatus, Priority, RuleType } from '@/apis';
import SelectionGroup from '@/components/library/SelectionGroup';
import { ALERT_CREATED_FOR, AlertCreatedForEnum, RULE_CASE_PRIORITY } from '@/pages/rules/utils';
import Select from '@/components/library/Select';
import * as Card from '@/components/ui/Card';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

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
  return (
    <Card.Root>
      <Card.Section>
        <div className={s.root}>
          <PropertyListLayout>
            <div className={s.section}>
              <InputField<FormValues, 'alertPriority'>
                name={'alertPriority'}
                label={'Alert severity'}
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
                    labelProps={{ required: true }}
                  >
                    {(inputProps) => (
                      <SelectionGroup<AlertCreatedForEnum>
                        mode="MULTIPLE"
                        options={ALERT_CREATED_FOR}
                        {...inputProps}
                      />
                    )}
                  </InputField>
                  <InputField<FormValues, 'alertCreationDirection'>
                    name={'alertCreationDirection'}
                    label={'Alert creation direction'}
                    labelProps={{ required: true }}
                  >
                    {(inputProps) => (
                      <Select<AlertCreationDirection>
                        allowClear={false}
                        options={[
                          { value: 'AUTO', label: 'Auto (based on the rule logic)' },
                          {
                            value: 'AUTO_ORIGIN',
                            label:
                              'Auto (based on the rule logic, but only create for origin user)',
                          },
                          {
                            value: 'AUTO_DESTINATION',
                            label:
                              'Auto (based on the rule logic, but only create for destination user)',
                          },
                          { value: 'ORIGIN', label: 'Origin user' },
                          { value: 'DESTINATION', label: 'Destination user' },
                          { value: 'ALL', label: 'Both origin user and destination user' },
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
                labelProps={{ element: 'div', required: { value: true, showHint: true } }}
              >
                {(inputProps) => <CreationIntervalInput {...inputProps} />}
              </InputField>
              <InputField<FormValues, 'falsePositiveCheckEnabled'>
                name={'falsePositiveCheckEnabled'}
                label={'False positive check'}
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
