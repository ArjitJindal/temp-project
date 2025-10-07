import { migrateAllTenants } from '../utils/tenant'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { ClickhouseTableNames } from '@/@types/clickhouse/table-names'
import { envIsNot } from '@/utils/env'
import { Tenant } from '@/@types/tenant'

async function migrateTenant(tenant: Tenant) {
  if (envIsNot('prod')) {
    return
  }
  if (
    ![
      '3227d9c851',
      '4PKTHPN204',
      'pnb',
      '2f4662976',
      '3c67921655',
      '198bb88f6a',
      '703b8be695',
      '78c5a44b9b',
    ].includes(tenant.id)
  ) {
    return
  }
  await sendBatchJobCommand({
    type: 'CLICKHOUSE_DATA_BACKFILL',
    tenantId: tenant.id,
    parameters: {
      type: { type: 'ALL' },
      referenceId: '0',
      tableNames: [ClickhouseTableNames.Cases],
    },
  })
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
