import { Select } from 'antd';
import { useCallback } from 'react';
import s from './index.module.less';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import { TenantSettings } from '@/apis';
import { TIMEZONES } from '@/utils/dayjs';
import Form from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';

export function OtherSettings() {
  const settings = useSettings();
  const mutateTenantSettings = useUpdateTenantSettings();
  const handleSubmit = useCallback(
    async (values) => {
      mutateTenantSettings.mutate({
        tenantTimezone: values.tenantTimezone,
      });
    },
    [mutateTenantSettings],
  );

  return (
    <>
      <h3>General settings</h3>
      <Form initialValues={settings} onSubmit={handleSubmit} className={s.root}>
        <InputField<TenantSettings> name={'tenantTimezone'} label={'Timezone'}>
          {(inputProps) => (
            <Select
              value={inputProps.value}
              onChange={inputProps.onChange}
              options={TIMEZONES.map((x) => ({ label: x, value: x }))}
              showSearch
            />
          )}
        </InputField>
        <div>
          <Button htmlType="submit" type="PRIMARY" isLoading={mutateTenantSettings.isLoading}>
            Save
          </Button>
        </div>
      </Form>
    </>
  );
}
