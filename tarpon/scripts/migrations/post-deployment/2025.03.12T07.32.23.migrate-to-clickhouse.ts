import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { ClickhouseTableNames } from '@/utils/clickhouse/definition'
import { envIsNot } from '@/utils/env'

export const up = async () => {
  if (envIsNot('prod')) {
    return
  }
  await sendBatchJobCommand({
    type: 'CLICKHOUSE_DATA_BACKFILL',
    tenantId: '3227d9c851',
    parameters: {
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
        ClickhouseTableNames.SanctionsScreeningDetails,
        ClickhouseTableNames.NangoRecords,
      ],
    },
  })
}
export const down = async () => {
  // skip
}
