import { useState } from 'react';
import { DerivedStatus } from '@/apis';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import { FROZEN_STATUSES } from '@/pages/rules/utils';

function dynamicStatusList(statuses: DerivedStatus[]) {
  return FROZEN_STATUSES.filter((status) => !statuses?.includes(status.value))
    .map((status) => status.label)
    .join(', ');
}

export function FrozenStatusesInput<FormValues extends { frozenStatuses: DerivedStatus[] }>() {
  const [frozenStatuses, setFrozenStatuses] = useState<DerivedStatus[]>([]);
  return (
    <InputField<FormValues, 'frozenStatuses'>
      name={'frozenStatuses'}
      label={
        'Stop adding transactions to the alert when the status changes to any of the following'
      }
      description={`Please note we will add transactions to all other statuses not selected, i.e., Open, ${dynamicStatusList(
        frozenStatuses,
      )}`}
    >
      {(inputProps) => (
        <Select
          mode="TAGS"
          {...inputProps}
          onChange={(value) => {
            setFrozenStatuses(value as DerivedStatus[]);
            if (inputProps.onChange) {
              inputProps.onChange(value);
            }
          }}
          options={FROZEN_STATUSES}
        />
      )}
    </InputField>
  );
}
