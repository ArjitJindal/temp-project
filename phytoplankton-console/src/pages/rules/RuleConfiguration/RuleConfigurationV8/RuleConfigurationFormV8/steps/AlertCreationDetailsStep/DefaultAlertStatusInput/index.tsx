import { FormValues } from '..';
import InputField from '@/components/library/Form/InputField';
import Select from '@/components/library/Select';
import { statusToOperationName } from '@/pages/case-management/components/StatusChangeButton';
import { DEFAULT_ALERT_STATUS_FOR_CASE_CREATIONS } from '@/apis/models-custom/DefaultAlertStatusForCaseCreation';

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
          options={DEFAULT_ALERT_STATUS_FOR_CASE_CREATIONS.map((status) => ({
            label: statusToOperationName(status, true),
            value: status,
            isDefault: status === 'OPEN',
          }))}
        />
      )}
    </InputField>
  );
};
