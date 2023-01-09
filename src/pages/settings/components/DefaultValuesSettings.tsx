import { Select, SelectProps, message } from 'antd';
import { useState, useEffect } from 'react';
import { useApi } from '@/api';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import { CURRENCIES_SELECT_OPTIONS } from '@/utils/currencies';

type TableItem = {
  valueType: string;
  options: SelectProps['options'];
  label: string;
};

const DEFAULT_VALUES = {
  currency: 'USD',
};

export const DefaultValuesSettings = () => {
  const [value, setValue] = useState<{ [key: string]: string }>(DEFAULT_VALUES);
  const [saving, setSaving] = useState(false);
  const settings = useSettings();
  const api = useApi();

  useEffect(() => {
    if (settings.defaultValues) {
      setValue((prev) => {
        return {
          ...prev,
          ...settings.defaultValues,
        };
      });
    }
  }, [settings.defaultValues]);

  const handleSave = async (key: string, value: string) => {
    try {
      setSaving(true);
      await api.postTenantsSettings({
        TenantSettings: {
          defaultValues: {
            ...settings.defaultValues,
            [key]: value,
          },
        },
      });
      message.success('Saved');
      setSaving(false);
    } catch (e) {
      message.error('Failed to update default values');
    }
  };

  return (
    <div>
      <Table<TableItem>
        columns={[
          {
            title: 'Value Type',
            dataIndex: 'valueType',
            key: 'valueType',
            render: (_, record) => record.label,
            width: 200,
          },
          {
            title: 'Options',
            dataIndex: 'options',
            key: 'options',
            render: (options, record) => (
              <Select
                value={value[record.valueType]}
                onChange={(value) => {
                  setValue({
                    ...value,
                    [record.valueType]: value,
                  });
                }}
                options={record.options}
                defaultValue={DEFAULT_VALUES[record.valueType]}
                showSearch
                style={{ width: '100%' }}
              />
            ),
            width: 600,
          },
          {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            render: (action, record) => (
              <Button
                type="primary"
                onClick={() => {
                  handleSave(record.valueType, value[record.valueType]);
                }}
                loading={saving}
              >
                Save
              </Button>
            ),
          },
        ]}
        data={{
          items: [
            {
              valueType: 'currency',
              options: CURRENCIES_SELECT_OPTIONS,
              label: 'Currency',
            },
          ],
        }}
        pagination={false}
        disableStripedColoring={true}
        rowKey="action"
        headerTitle="Default Values"
        search={false}
      />
    </div>
  );
};
