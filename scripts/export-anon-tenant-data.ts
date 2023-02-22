import { exit } from 'process'
import { program } from 'commander'
import { StackConstants } from '@cdk/constants'
import { Db, MongoClient } from 'mongodb'
import ProgressBar from 'progress'

import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { logger } from '@/core/logger'
import { anonymize } from '@/utils/anonymize'

program.argument('tenant ID').argument('output DB connection URL').parse()

const tenantId = program.args[0]
const outputDBUrl = program.args[1]

let inputDB: Db

async function exportTenantData(tenantId: string) {
  logger.info(`Starting export for tenant ${tenantId}...`)
  inputDB = (await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)).db()
  const outputDB = (await MongoClient.connect(outputDBUrl)).db()
  const re = new RegExp(tenantId + '-' + '.*')
  const allMongoDbCollections = await inputDB
    .listCollections({
      name: re,
    })
    .toArray()
  for (const collection of allMongoDbCollections) {
    logger.info('Processing ' + collection.name)
    const collectionName = collection.name
    const collectionData = await inputDB.collection(collectionName).find()

    const count = await inputDB.collection(collectionName).countDocuments()

    if (count == 0) {
      console.log('Skipping empty ' + collectionName)
      continue
    }
    const bar = new ProgressBar('-> Processing [:bar] :percent :etas', {
      total: count,
      width: 30,
    })

    if ((await outputDB.collection(collectionName).countDocuments()) > 0) {
      await outputDB.collection(collectionName).drop()
    }

    let collectionDataAnonymized = []
    for await (const document of collectionData) {
      if (!document) continue
      collectionDataAnonymized.push(
        anonymize(collectionName.replace(`${tenantId}-`, ''), document)
      )
      bar.tick(1)

      if (collectionDataAnonymized.length == 1000) {
        await outputDB
          .collection(collectionName)
          .insertMany(collectionDataAnonymized)
        collectionDataAnonymized = []
      }
    }

    // Process the final batch
    if (collectionDataAnonymized.length > 0) {
      await outputDB
        .collection(collectionName)
        .insertMany(collectionDataAnonymized)
      collectionDataAnonymized = []
    }

    console.log('Created anonymous', collectionName, 'in output DB')
  }
}

exportTenantData(tenantId)
  .then(() => exit(0))
  .catch((e) => {
    logger.error(e)
    exit(1)
  })
