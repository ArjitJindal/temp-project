import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'

export const up = async () => {
  const db = await getMongoDbClientDb()
  const acurisCollection = (await db.listCollections().toArray()).find((c) =>
    c.name.includes('acuris')
  )
  if (acurisCollection) {
    await sendBatchJobCommand({
      type: 'SANCTIONS_DATA_FETCH',
      tenantId: 'flagright',
      providers: ['acuris'],
      parameters: {
        entityType: 'PERSON',
      },
    })
    await sendBatchJobCommand({
      type: 'SANCTIONS_DATA_FETCH',
      tenantId: 'flagright',
      providers: ['acuris'],
      parameters: {
        entityType: 'BUSINESS',
      },
    })
  }
}
export const down = async () => {
  // skip
}
