import { Select, SelectProps } from 'antd';
import { useState, useEffect, useMemo } from 'react';
import { CURRENCIES_SELECT_OPTIONS } from '@flagright/lib/constants';
import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import Table from '@/components/library/Table';
import { TIMEZONES } from '@/utils/dayjs';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { StatePair } from '@/utils/state';
import { useHasPermissions } from '@/utils/user-utils';

type TableItem = {
  valueType: string;
  options: SelectProps['options'];
  label: string;
};

type ExternalState = {
  value: StatePair<{ [key: string]: string }>;
  saving: boolean;
  onSave: (key: string, value: string) => void;
};

const DEFAULT_VALUES = {
  currency: 'USD',
};

const columnHelper = new ColumnHelper<TableItem>();

export const DefaultValuesSettings = () => {
  const [value, setValue] = useState<{ [key: string]: string }>(DEFAULT_VALUES);
  const settings = useSettings();

  const hasSystemConfigWrite = useHasPermissions(['settings:system-config:write']);

  const columns = useMemo(
    () =>
      columnHelper.list([
        columnHelper.simple({
          title: 'Value type',
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
                onChange={(selectedValue) => {
                  setValue((value) => ({
                    ...value,
                    [record.valueType]: selectedValue,
                  }));
                }}
                options={record.options}
                defaultValue={DEFAULT_VALUES[record.valueType]}
                showSearch
                style={{ width: '100%' }}
                disabled={!hasSystemConfigWrite}
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
            const saving = externalState.saving;
            return (
              <Button
                type="PRIMARY"
                onClick={() => {
                  onSave(record.valueType, value[record.valueType]);
                }}
                isLoading={saving}
                requiredPermissions={['settings:system-config:write']}
              >
                Save
              </Button>
            );
          },
        }),
      ]),
    [hasSystemConfigWrite],
  );

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

  const mutateTenantSettings = useUpdateTenantSettings();
  const handleSave = async (key: string, value: string) => {
    mutateTenantSettings.mutate({
      defaultValues: {
        ...settings.defaultValues,
        [key]: value,
      },
    });
  };

  const externalState: ExternalState = {
    value: [value, setValue],
    saving: mutateTenantSettings.isLoading,
    onSave: handleSave,
  };
  return (
    <div>
      <SettingsCard
        title="Default values"
        description="Define values that are constant throughout the console."
      >
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
              {
                valueType: 'tenantTimezone',
                options: TIMEZONES.map((x) => ({ label: x, value: x })),
                label: 'Time zone',
              },
            ],
          }}
          pagination={false}
          externalState={externalState}
        />
      </SettingsCard>
    </div>
  );
};
