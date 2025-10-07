import { stageAndRegion } from '@flagright/lib/utils/env'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { ClickhouseTableNames } from '@/@types/clickhouse/table-names'
import { envIsNot } from '@/utils/env'
export const up = async () => {
  const [_, region] = stageAndRegion()
  if (envIsNot('prod') || region !== 'us-1') {
    return
  }
  await sendBatchJobCommand({
    type: 'CLICKHOUSE_DATA_BACKFILL',
    tenantId: 'e5eb4e1664',
    parameters: {
      type: { type: 'ALL' },
      referenceId: '0',
      tableNames: [
        ClickhouseTableNames.Transactions,
        ClickhouseTableNames.Users,
        ClickhouseTableNames.TransactionEvents,
        ClickhouseTableNames.UserEvents,
        ClickhouseTableNames.Cases,
        ClickhouseTableNames.Reports,
        ClickhouseTableNames.KrsScore,
        ClickhouseTableNames.DrsScore,
        ClickhouseTableNames.ArsScore,
        ClickhouseTableNames.CrmRecords,
        ClickhouseTableNames.CrmUserRecordLink,
      ],
    },
  })
}
export const down = async () => {
  // skip
}
