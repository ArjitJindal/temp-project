import { FormValues } from '..';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import { RuleInstanceAlertConfigDefaultAlertStatusEnum } from '@/apis';

const DEFAULT_ALERT_STATUS_OPTIONS: RuleInstanceAlertConfigDefaultAlertStatusEnum[] = [
  'CLOSED',
  'OPEN',
  'OPEN_ON_HOLD',
];

export const DefaultAlertStatusInput = () => {
  return (
    <InputField<FormValues, 'defaultAlertStatus'>
      name={'defaultAlertStatus'}
      label={'Default alert creation status'}
      description="If not specified, the alert will be created with the open status"
      labelProps={{
        required: {
          value: false,
          showHint: true,
        },
      }}
    >
      {(inputProps) => (
        <Select
          mode="SINGLE"
          {...inputProps}
          onChange={(value) => {
            if (inputProps.onChange) {
              inputProps.onChange(value);
            }
          }}
          options={DEFAULT_ALERT_STATUS_OPTIONS.map((status) => ({
            label: status,
            value: status,
            isDefault: status === 'OPEN',
          }))}
        />
      )}
    </InputField>
  );
};
