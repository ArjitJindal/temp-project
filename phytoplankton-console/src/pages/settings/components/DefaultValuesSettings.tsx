import { Select, SelectProps } from 'antd';
import { useState, useEffect, useMemo } from 'react';
import { CURRENCIES_SELECT_OPTIONS } from '@flagright/lib/constants';
import { Resource, hasResources } from '@flagright/lib/utils';
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
import { useResources } from '@/components/AppWrapper/Providers/StatementsProvider';

type TableItem = {
  valueType: string;
  options: SelectProps['options'];
  label: string;
  requiredResources: { read: Resource[]; write: Resource[] };
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

  const { statements } = useResources();

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
                disabled={!hasResources(statements, record.requiredResources.write)}
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
                requiredResources={record.requiredResources.write}
              >
                Save
              </Button>
            );
          },
        }),
      ]),
    [statements],
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
          externalState={externalState}
        />
      </SettingsCard>
    </div>
  );
};
