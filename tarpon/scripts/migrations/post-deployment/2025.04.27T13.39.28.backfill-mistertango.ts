import { stageAndRegion } from '@flagright/lib/utils/env'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE } from '@/constants/clickhouse/clickhouse-mongo-map'
import { envIsNot } from '@/utils/env'
export const up = async () => {
  const [_, region] = stageAndRegion()
  if (envIsNot('prod') || region !== 'eu-1') {
    return
  }
  await sendBatchJobCommand({
    type: 'CLICKHOUSE_DATA_BACKFILL',
    tenantId: '0cf1ffbc6d',
    parameters: {
      type: { type: 'ALL' },
      referenceId: '0',
      tableNames: Object.values(MONGO_COLLECTION_SUFFIX_MAP_TO_CLICKHOUSE),
    },
  })
}
export const down = async () => {
  // skip
}
