import { Select, SelectProps } from 'antd';
import { useState, useEffect } from 'react';
import { useApi } from '@/api';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import Table from '@/components/library/Table';
import { CURRENCIES_SELECT_OPTIONS } from '@/utils/currencies';
import { message } from '@/components/library/Message';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { StatePair } from '@/utils/state';

type TableItem = {
  valueType: string;
  options: SelectProps['options'];
  label: string;
};

type ExternalState = {
  value: StatePair<{ [key: string]: string }>;
  saving: StatePair<boolean>;
  onSave: (key: string, value: string) => void;
};

const DEFAULT_VALUES = {
  currency: 'USD',
};

const columnHelper = new ColumnHelper<TableItem>();

const columns = columnHelper.list([
  columnHelper.simple({
    title: 'Value Type',
    key: 'label',
  }),
  columnHelper.display({
    title: 'Options',
    id: 'options',
    render: (record, context) => {
      const externalState: ExternalState = context.external as ExternalState;
      const [value, setValue] = externalState.value;
      return (
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
      );
    },
    defaultWidth: 600,
  }),
  columnHelper.display({
    id: 'action',
    title: 'Action',
    render: (record, context) => {
      const externalState: ExternalState = context.external as ExternalState;
      const { onSave } = externalState;
      const [value] = externalState.value;
      const [saving] = externalState.saving;
      return (
        <Button
          type="PRIMARY"
          onClick={() => {
            onSave(record.valueType, value[record.valueType]);
          }}
          isLoading={saving}
        >
          Save
        </Button>
      );
    },
  }),
]);

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
      message.fatal('Failed to update default values', e);
    }
  };

  const externalState: ExternalState = {
    value: [value, setValue],
    saving: [saving, setSaving],
    onSave: handleSave,
  };
  return (
    <div>
      <Table<TableItem>
        rowKey="label"
        sizingMode="FULL_WIDTH"
        toolsOptions={false}
        columns={columns}
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
        externalState={externalState}
      />
    </div>
  );
};
