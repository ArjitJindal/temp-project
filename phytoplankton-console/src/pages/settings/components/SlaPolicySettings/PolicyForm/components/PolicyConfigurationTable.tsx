import React, { useMemo, useState } from 'react';
import { capitalize } from 'lodash';
import { humanizeSnakeCase } from '@flagright/lib/utils/humanize';
import { FormValues } from '../../utils/utils';
import s from './styles.module.less';
import OperatorSelect from './OperatorSelect';
import TimeInput from './TimeInput';
import StatusesCountInput from './StatusesCountInput';
import Label from '@/components/library/Label';
import Select, { Option } from '@/components/library/Select';
import { useRoles } from '@/utils/api/auth';
import { DERIVED_STATUSS } from '@/apis/models-custom/DerivedStatus';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';
import GenericFormField from '@/components/library/Form/GenericFormField';
import { useFormContext } from '@/components/library/Form/utils/hooks';
import NestedForm from '@/components/library/Form/NestedForm';
import { PolicyStatusDetailsStatusesEnum } from '@/apis/models/PolicyStatusDetails';
import Button from '@/components/library/Button';
import { SLAPolicyConfigurationWorkingDaysEnum } from '@/apis';

const workingDaysOptions: Option<SLAPolicyConfigurationWorkingDaysEnum>[] = [
  { value: 'MON', label: 'Monday' },
  { value: 'TUE', label: 'Tuesday' },
  { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' },
  { value: 'FRI', label: 'Friday' },
  { value: 'SAT', label: 'Saturday' },
  { value: 'SUN', label: 'Sunday' },
];

function PolicyConfigurationTable() {
  const formContext = useFormContext<FormValues['policyConfiguration']>();
  const statusCountDetails = formContext.values?.statusDetails?.statusesCount;
  const { rolesList } = useRoles();
  const warningTime = formContext.values?.SLATime?.warningTime;
  const statuses = formContext.values?.statusDetails?.statuses;
  const [isWarningTime, setIsWarningTime] = useState(warningTime ? true : false);
  const [isStatusCount, setIsStatusCount] = useState(statusCountDetails ? true : false);
  const roleOptions = useMemo(() => {
    return rolesList
      .map((role) => ({ label: capitalize(role.name) ?? '', value: role.name ?? '' }))
      .filter((data) => data.label !== '');
  }, [rolesList]);
  return (
    <div className={s.root}>
      <div className={s.table}>
        <div className={s.header}>Criteria</div>
        <div className={s.header}>Operator</div>
        <div className={s.header}>Value</div>
        <Label label="Account Role" />
        <OperatorSelect value="EQ" options={[{ value: 'EQ', label: '=' }]} isDisabled />
        <GenericFormField<FormValues['policyConfiguration'], 'accountRoles'> name="accountRoles">
          {(inputProps) => <Select mode="MULTIPLE_DYNAMIC" options={roleOptions} {...inputProps} />}
        </GenericFormField>
        <NestedForm name="SLATime">
          <Label label="Service level agreement time" required={{ value: true, showHint: true }} />
          <OperatorSelect
            value="EQ"
            options={[{ value: 'EQ', label: '=' }]}
            isDisabled
            onChange={() => {}}
          />
          <div className={s.nestedValue}>
            <GenericFormField<
              FormValues['policyConfiguration']['SLATime'],
              'breachTime'
            > name="breachTime">
              {(inputProps) => {
                return (
                  <TimeInput
                    value={inputProps.value}
                    onChange={(value) => {
                      if (value) {
                        inputProps.onChange?.(value);
                      }
                    }}
                  />
                );
              }}
            </GenericFormField>
            <Button
              onClick={() => {
                if (isWarningTime) {
                  formContext.setValues({
                    ...formContext.values,
                    SLATime: {
                      breachTime: formContext.values.SLATime.breachTime,
                    },
                  });
                }
                setIsWarningTime((value) => !value);
              }}
              type={isWarningTime ? 'DANGER' : 'TEXT'}
            >
              {isWarningTime ? 'Remove' : 'Set warning time'}
            </Button>
          </div>
          {isWarningTime && (
            <>
              <div className={s.indentedLabel}>
                <Label label="Warning time" />
              </div>
              <OperatorSelect value="EQ" options={[{ value: 'EQ', label: '=' }]} isDisabled />
              <GenericFormField<
                FormValues['policyConfiguration']['SLATime'],
                'warningTime'
              > name="warningTime">
                {(inputProps) => {
                  return (
                    <TimeInput
                      value={inputProps.value}
                      onChange={(value) => {
                        inputProps.onChange?.(value);
                      }}
                    />
                  );
                }}
              </GenericFormField>
            </>
          )}
        </NestedForm>
        <Label label="Working days" required={{ value: true, showHint: true }} />
        <OperatorSelect
          value="CONTAINS"
          options={[{ value: 'CONTAINS', label: 'Contains' }]}
          isDisabled
        />
        <GenericFormField<FormValues['policyConfiguration'], 'workingDays'> name="workingDays">
          {(inputProps) => <Select mode="MULTIPLE" options={workingDaysOptions} {...inputProps} />}
        </GenericFormField>
        <NestedForm name="statusDetails">
          <Label label="Statuses" required={{ value: true, showHint: true }} />
          <OperatorSelect
            value="CONTAINS"
            options={[{ value: 'CONTAINS', label: 'Contains' }]}
            isDisabled
          />
          <div className={s.nestedValue}>
            <GenericFormField<
              FormValues['policyConfiguration']['statusDetails'],
              'statuses'
            > name="statuses">
              {(inputProps) => (
                <div className={s.statusSelect}>
                  <Select<PolicyStatusDetailsStatusesEnum>
                    mode="MULTIPLE"
                    options={(
                      DERIVED_STATUSS.filter(
                        (status) => status !== 'CLOSED',
                      ) as PolicyStatusDetailsStatusesEnum[]
                    ).map((status) => ({
                      value: status,
                      label: <CaseStatusTag caseStatus={status} />,
                      labelText: humanizeSnakeCase(status),
                    }))}
                    {...inputProps}
                    value={inputProps.value}
                    onChange={(value) => {
                      inputProps.onChange?.(value);
                    }}
                  />
                </div>
              )}
            </GenericFormField>
            <Button
              onClick={() => {
                if (isStatusCount) {
                  formContext.setValues({
                    ...formContext.values,
                    statusDetails: {
                      statuses: formContext.values?.statusDetails?.statuses,
                    },
                  });
                }
                setIsStatusCount((value) => !value);
              }}
              type={isStatusCount ? 'DANGER' : 'TEXT'}
            >
              {isStatusCount ? 'Remove' : 'Add status count'}
            </Button>
          </div>
          {isStatusCount && (
            <GenericFormField<
              FormValues['policyConfiguration']['statusDetails'],
              'statusesCount'
            > name="statusesCount">
              {(inputProps) => (
                <StatusesCountInput
                  onChange={(value) => {
                    inputProps.onChange?.(value);
                  }}
                  currentValues={inputProps.value}
                  statuses={statuses}
                />
              )}
            </GenericFormField>
          )}
        </NestedForm>
      </div>
    </div>
  );
}

export default PolicyConfigurationTable;
