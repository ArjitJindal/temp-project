import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { ClickhouseTableNames } from '@/@types/clickhouse/table-names'
import { envIsNot } from '@/utils/env'

export const up = async () => {
  if (envIsNot('prod')) {
    return
  }
  await sendBatchJobCommand({
    type: 'CLICKHOUSE_DATA_BACKFILL',
    tenantId: '46fe6f381c',
    parameters: {
      type: { type: 'ALL' },
      referenceId: '0',
      tableNames: [ClickhouseTableNames.SanctionsScreeningDetails],
    },
  })
}
export const down = async () => {
  // skip
}
