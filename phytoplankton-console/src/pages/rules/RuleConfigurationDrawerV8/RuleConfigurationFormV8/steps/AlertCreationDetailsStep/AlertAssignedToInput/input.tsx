import { useMemo, useState } from 'react';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import SelectionGroup from '@/components/library/SelectionGroup';
import Alert from '@/components/library/Alert';
import { useRoles, useUsers } from '@/utils/user-utils';

export const AlertAssignedToInput = <
  FormValues extends {
    alertAssigneesType?: 'EMAIL' | 'ROLE';
    alertAssignees?: string[];
    alertAssigneeRole?: string;
  },
>(props: {
  alertAssigneesType: FormValues['alertAssigneesType'];
}) => {
  const [alertAssigneesType, setAssigneesType] = useState<'EMAIL' | 'ROLE' | ''>(
    props.alertAssigneesType ?? '',
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
    </>
  );
};
