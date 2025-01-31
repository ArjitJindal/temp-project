import { humanizeAuto } from '@flagright/lib/utils/humanize';
import React from 'react';
import s from './styles.module.less';
import { useFieldState } from '@/components/library/Form/utils/hooks';
import NestedForm from '@/components/library/Form/NestedForm';
import InputField from '@/components/library/Form/InputField';
import { AssignmentSelect } from '@/pages/accounts/components/AssignmentSelect';
import { RoleSelect } from '@/pages/accounts/components/RoleSelect';
import RadioGroup from '@/components/ui/RadioGroup';
import { Account } from '@/apis';

export type SecondPersonType = 'ROLE' | 'ACCOUNT';

// disabled until "role" target is implemented on the backend side
const IS_ROLE_DISABLED = true;

export type SecondPerson = {
  type?: SecondPersonType;
  assignees?: string[];
  role?: string;
};

interface Props<FormValues, Key extends keyof FormValues> {
  name: Key;
  typeLabel: string;
  assignmentsLabel: string;
  assignmentsPlaceholder: string;
  roleLabel: string;
  rolePlaceholder: string;
  assignmentsCustomFilter?: (option: Account) => boolean;
}

export default function SecondPersonFields<FormValues, Key extends keyof FormValues>(
  props: Props<FormValues, Key>,
) {
  const {
    name,
    typeLabel,
    assignmentsLabel,
    assignmentsPlaceholder,
    assignmentsCustomFilter,
    roleLabel,
    rolePlaceholder,
  } = props;

  const fieldState = useFieldState<FormValues, Key>(name);

  const secondPerson = fieldState.value as SecondPerson | undefined;
  const typeSelected = secondPerson?.type;

  return (
    <NestedForm<SecondPerson> name={String(name)}>
      <>
        {!IS_ROLE_DISABLED && (
          <InputField<SecondPerson, 'type'> label={typeLabel} name={'type'}>
            {(inputProps) => (
              <div className={s.permissionsGroup}>
                <RadioGroup
                  options={(['ROLE', 'ACCOUNT'] as const).map((x) => ({
                    value: x,
                    label: humanizeAuto(x),
                  }))}
                  {...inputProps}
                />
              </div>
            )}
          </InputField>
        )}
        {typeSelected === 'ACCOUNT' && (
          <InputField<SecondPerson, 'assignees'> label={assignmentsLabel} name={'assignees'}>
            {(inputProps) => (
              <AssignmentSelect
                {...inputProps}
                placeholder={assignmentsPlaceholder}
                customFilter={assignmentsCustomFilter}
              />
            )}
          </InputField>
        )}
        {typeSelected === 'ROLE' && (
          <InputField<SecondPerson, 'role'> name={'role'} label={roleLabel}>
            {(inputProps) => <RoleSelect {...inputProps} placeholder={rolePlaceholder} />}
          </InputField>
        )}
      </>
    </NestedForm>
  );
}
