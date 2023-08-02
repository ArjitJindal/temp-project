import { startCase, toLower } from 'lodash';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { H2 } from '@/components/ui/Typography';
import { humanizeCamelCase } from '@/utils/humanize';
import { useQuery } from '@/utils/queries/hooks';
import { TENANT_USAGE_DATA } from '@/utils/queries/keys';

export function QuotaSettings() {
  const api = useApi();
  const usagePlanQueryResult = useQuery<Array<Record<string, string | number>>>(
    TENANT_USAGE_DATA(),
    async () => {
      const usageData = await api.getTenantUsageData();

      return Object.entries(usageData).map(([key, value]: [string, string | number]) => ({
        key: humanizeCamelCase(key),
        value: startCase(toLower(value.toString())),
      }));
    },
  );
  const columnHelper = new ColumnHelper<Record<string, string | number>>();

  const columns = columnHelper.list([
    columnHelper.simple({
      title: 'Value Type',
      key: 'key',
    }),
    columnHelper.simple({
      title: 'Value',
      key: 'value',
    }),
  ]);

  return (
    <>
      <H2>Quotas</H2>
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
    </>
  );
}
