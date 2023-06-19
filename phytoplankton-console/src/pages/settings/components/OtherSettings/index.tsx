import { Select } from 'antd';
import React, { useCallback, useState } from 'react';
import s from './index.module.less';
import { useApi } from '@/api';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import { TenantSettings } from '@/apis';
import { TIMEZONES } from '@/utils/dayjs';
import Form from '@/components/library/Form';
import InputField from '@/components/library/Form/InputField';
import { message } from '@/components/library/Message';

export function OtherSettings() {
  const settings = useSettings();
  const [saving, setSaving] = useState(false);
  const api = useApi();

  const handleSubmit = useCallback(
    async (values) => {
      setSaving(true);
      try {
        await api.postTenantsSettings({
          TenantSettings: values,
        });
        message.success('Saved');
      } catch (e) {
        message.fatal('Failed to update default values', e);
      } finally {
        setSaving(false);
      }
    },
    [api],
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
          <Button htmlType="submit" type="PRIMARY" isLoading={saving}>
            Save
          </Button>
        </div>
      </Form>
    </>
  );
}
