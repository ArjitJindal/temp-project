import { startCase, toLower } from 'lodash';
import { humanizeCamelCase } from '@flagright/lib/utils/humanize';
import SettingsCard from '@/components/library/SettingsCard';
import { useTenantUsageData } from '@/hooks/api/settings';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { formatNumber } from '@/utils/number';

export function QuotaSettings() {
  const usageDataRes = useTenantUsageData();
  const usagePlanQueryResult: any = {
    data: (usageDataRes.data as any)?.map(([key, value]: [string, string | number]) => ({
      key: humanizeCamelCase(key),
      value: isNaN(Number(value))
        ? startCase(toLower(value.toString()))
        : formatNumber(Number(value)),
    })),
  };
  const columnHelper = new ColumnHelper<Record<string, string | number>>();

  const columns = columnHelper.list([
    columnHelper.simple({
      title: 'Value type',
      key: 'key',
    }),
    columnHelper.simple({
      title: 'Value',
      key: 'value',
    }),
  ]);

  return (
    <SettingsCard
      title="Quotas"
      description="Find your provisioned API Quota and rate limits."
      minRequiredResources={['read:::settings/developers/quotas/*']}
    >
      <AsyncResourceRenderer<Array<Record<string, string | number>>>
        resource={usagePlanQueryResult.data}
      >
        {(usagePlan) => (
          <Table
            columns={columns}
            data={{
              items: usagePlan,
            }}
            rowKey="key"
            pagination={false}
          />
        )}
      </AsyncResourceRenderer>
    </SettingsCard>
  );
}
