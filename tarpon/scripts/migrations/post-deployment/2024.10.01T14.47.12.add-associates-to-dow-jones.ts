import { deleteUnusedRuleParameter } from '../utils/rule'
import { MongoSanctionsRepository } from '@/services/sanctions/repositories/sanctions-repository'
import dayjs from '@/utils/dayjs'
import { DowJonesProvider } from '@/services/sanctions/providers/dow-jones-provider'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { SANCTIONS_COLLECTION } from '@/utils/mongodb-definitions'

export const up = async () => {
  const db = await getMongoDbClientDb()
  const collection = db.collection(SANCTIONS_COLLECTION)
  // Delete all records, as cleanup was done with the current PR changes, some fields were not present in the database as they were added in between
  await collection.deleteMany()
  const repo = new MongoSanctionsRepository()
  const dowJonesFetcher = await DowJonesProvider.build()
  const version = dayjs().format('YYYY-MM')
  await dowJonesFetcher.fullLoad(repo, version)

  await deleteUnusedRuleParameter(
    ['sanctions-consumer-user'],
    [],
    ['fuzzinessRange']
  )
}
export const down = async () => {
  // skip
}
