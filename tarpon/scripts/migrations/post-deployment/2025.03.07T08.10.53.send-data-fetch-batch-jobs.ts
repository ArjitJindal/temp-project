import { COLLECTIONS_MAP } from '@/services/sanctions/utils'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { SanctionsDataProviderName } from '@/@types/openapi-internal/SanctionsDataProviderName'
import { envIs } from '@/utils/env'

export const up = async () => {
  if (envIs('prod')) {
    return
  }
  await Promise.all(
    Object.entries(COLLECTIONS_MAP).flatMap(([provider, entityTypes]) => {
      return entityTypes.map((t) => {
        return sendBatchJobCommand({
          type: 'SANCTIONS_DATA_FETCH',
          tenantId: 'flagright',
          providers: [provider as SanctionsDataProviderName],
          parameters: {
            entityType: t,
          },
        })
      })
    })
  )
}
export const down = async () => {
  // skip
}
