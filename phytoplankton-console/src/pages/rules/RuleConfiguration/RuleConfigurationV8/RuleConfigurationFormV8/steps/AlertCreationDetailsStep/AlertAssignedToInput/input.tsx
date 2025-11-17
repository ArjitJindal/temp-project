import { useMemo } from 'react';
import { capitalize } from 'lodash';
import { FormValues } from '..';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import SelectionGroup from '@/components/library/SelectionGroup';
import Alert from '@/components/library/Alert';
import { useRoles, useUsers } from '@/utils/api/auth';

import { useFieldState } from '@/components/library/Form/utils/hooks';
import { getAccountUserName } from '@/utils/user-utils';

export function AlertAssignedToInput() {
  const alertAssigneesTypeFieldState = useFieldState<FormValues>('alertAssigneesType');

  const { users } = useUsers({ includeBlockedUsers: false, includeRootUsers: true });
  const { rolesList } = useRoles();
  const options = useMemo(() => {
    if (alertAssigneesTypeFieldState.value === 'EMAIL') {
      return Object.values(users).map((user) => ({
        label: getAccountUserName(user),
        value: user?.id,
      }));
    } else {
      return rolesList
        .map((role) => ({ label: capitalize(role.name) ?? '', value: role.id ?? '' }))
        .filter((data) => data.label !== '');
    }
  }, [users, rolesList, alertAssigneesTypeFieldState.value]);

  return (
    <>
      <InputField<FormValues, 'alertAssigneesType'>
        name={'alertAssigneesType'}
        label={'Alert assigned to'}
        description={
          'Automatically assign an alert to an account or equally distribute the workfload across a role'
        }
        labelProps={{ required: { value: false, showHint: true } }}
      >
        {(inputProps) => {
          return (
            <SelectionGroup<'EMAIL' | 'ROLE' | 'NONE'>
              mode="SINGLE"
              options={[
                { label: 'None', value: 'NONE' },
                { label: 'Account', value: 'EMAIL' },
                { label: 'Role', value: 'ROLE' },
              ]}
              {...inputProps}
              value={inputProps.value ?? 'NONE'}
              onChange={(value) => {
                if (value === 'NONE') {
                  inputProps.onChange?.(undefined);
                } else {
                  inputProps.onChange?.(value);
                }
              }}
            />
          );
        }}
      </InputField>
      {alertAssigneesTypeFieldState.value === 'EMAIL' && (
        <>
          <InputField<FormValues, 'alertAssignees'>
            name={'alertAssignees'}
            label={'Assign to account(s)'}
            labelProps={{
              required: true,
            }}
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
          <Alert type="INFO">
            Please note if one or more accounts are selected, the alert will be automatically
            assigned and distributed equally.
          </Alert>
        </>
      )}
      {alertAssigneesTypeFieldState.value === 'ROLE' && (
        <>
          <InputField<FormValues, 'alertAssigneeRole'>
            name={'alertAssigneeRole'}
            label={'Assign to role'}
            labelProps={{
              required: true,
            }}
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
          <Alert type="INFO">
            Please note that the alert is automatically assigned and equally distributed among the
            accounts within the role.
          </Alert>
        </>
      )}
    </>
  );
}
