import {
  sendAcurisSanctionsDataFetch,
  sendOpenSanctionsSanctionsDataFetch,
} from '../utils/trigger-sanctions-data-fetch'
import { envIsNot } from '@/utils/env'
import { createIndex, getOpensearchClient } from '@/utils/opensearch-utils'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'

export const up = async () => {
  if (envIsNot('prod')) {
    const client = await getOpensearchClient()
    const db = await getMongoDbClientDb()
    const acurisCollections = (await db.listCollections().toArray()).filter(
      (c) => c.name.includes('acuris')
    )
    if (acurisCollections?.length) {
      for (const collection of acurisCollections) {
        await createIndex(client, collection.name)
      }
      await sendAcurisSanctionsDataFetch()
    }
    const openSanctionsCollections = (
      await db.listCollections().toArray()
    ).filter((c) => c.name.includes('open-sanctions'))
    if (openSanctionsCollections?.length) {
      for (const collection of openSanctionsCollections) {
        await createIndex(client, collection.name)
      }
      await sendOpenSanctionsSanctionsDataFetch()
    }
  }
}
export const down = async () => {
  // skip
}
