import { startCase, toLower } from 'lodash';
import { humanizeCamelCase } from '@flagright/lib/utils/humanize';
import SettingsCard from '@/components/library/SettingsCard';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { useQuery } from '@/utils/queries/hooks';
import { TENANT_USAGE_DATA } from '@/utils/queries/keys';
import { formatNumber } from '@/utils/number';

export function QuotaSettings() {
  const api = useApi();
  const usagePlanQueryResult = useQuery<Array<Record<string, string | number>>>(
    TENANT_USAGE_DATA(),
    async () => {
      const usageData = await api.getTenantUsageData();

      return Object.entries(usageData).map(([key, value]: [string, string | number]) => ({
        key: humanizeCamelCase(key),
        value: isNaN(Number(value))
          ? startCase(toLower(value.toString()))
          : formatNumber(Number(value)),
      }));
    },
  );
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
