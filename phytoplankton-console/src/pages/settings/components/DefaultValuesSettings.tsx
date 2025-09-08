import { useState, useEffect, useMemo, useCallback } from 'react';
import { CURRENCIES_SELECT_OPTIONS } from '@flagright/lib/constants';
import { Resource, hasResources } from '@flagright/lib/utils';
import Select, { Option } from '@/components/library/Select';
import SettingsCard from '@/components/library/SettingsCard';
import {
  useSettings,
  useUpdateTenantSettings,
  useResources,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import Button from '@/components/library/Button';
import Table from '@/components/library/Table';
import { TIMEZONES } from '@/utils/dayjs';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
type TableItem = {
  valueType: string;
  options: Option<string>[];
  label: string;
  requiredResources: { read: Resource[]; write: Resource[] };
};

// externalState removed

const DEFAULT_VALUES = {
  currency: 'USD',
};

const columnHelper = new ColumnHelper<TableItem>();

export const DefaultValuesSettings = () => {
  const [value, setValue] = useState<{ [key: string]: string }>(DEFAULT_VALUES);
  const settings = useSettings();

  const { statements } = useResources();
  const mutateTenantSettings = useUpdateTenantSettings();
  const handleSave = useCallback(
    (key: string, v: string) => {
      mutateTenantSettings.mutate({
        defaultValues: {
          ...settings.defaultValues,
          [key]: v,
        },
      });
    },
    [mutateTenantSettings, settings.defaultValues],
  );
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
          render: (record) => {
            return (
              <Select
                value={value[record.valueType]}
                onChange={(selectedValue) => {
                  setValue((prev) => ({
                    ...prev,
                    [record.valueType]: selectedValue ?? '',
                  }));
                }}
                options={record.options}
                isDisabled={!hasResources(statements, record.requiredResources.write)}
              />
            );
          },
          defaultWidth: 600,
        }),
        columnHelper.display({
          id: 'action',
          title: 'Action',
          render: (record) => {
            return (
              <Button
                type="PRIMARY"
                onClick={() => {
                  handleSave(record.valueType, value[record.valueType]);
                }}
                isLoading={mutateTenantSettings.isLoading}
                requiredResources={record.requiredResources.write}
              >
                Save
              </Button>
            );
          },
        }),
      ]),
    [value, statements, mutateTenantSettings.isLoading, handleSave],
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

  const items: TableItem[] = useMemo(() => {
    const items: TableItem[] = [
      {
        valueType: 'currency',
        options: CURRENCIES_SELECT_OPTIONS,
        label: 'Currency',
        requiredResources: {
          read: ['read:::settings/system-config/default-values/currency/*'],
          write: ['write:::settings/system-config/default-values/currency/*'],
        },
      },
      {
        valueType: 'tenantTimezone',
        options: TIMEZONES.map((x) => ({ label: x, value: x })),
        label: 'Time zone',
        requiredResources: {
          read: ['read:::settings/system-config/default-values/timezone/*'],
          write: ['write:::settings/system-config/default-values/timezone/*'],
        },
      },
    ];

    return items.filter((item) => hasResources(statements, item.requiredResources.read));
  }, [statements]);

  return (
    <div>
      <SettingsCard
        title="Default values"
        description="Define values that are constant throughout the console."
        minRequiredResources={['read:::settings/system-config/default-values/*']}
      >
        <Table<TableItem>
          rowKey="label"
          sizingMode="FULL_WIDTH"
          toolsOptions={false}
          columns={columns}
          data={{ items }}
          pagination={false}
        />
      </SettingsCard>
    </div>
  );
};
