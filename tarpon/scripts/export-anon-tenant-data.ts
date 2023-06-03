import { exit } from 'process'
import { program } from 'commander'
import { StackConstants } from '@lib/constants'
import { MongoClient } from 'mongodb'

import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { logger } from '@/core/logger'
import { copyCollections } from '@/utils/seed'
import { anonymize } from '@/utils/anonymize'

program.argument('tenant ID').argument('output DB connection URL').parse()

const tenantId = program.args[0]
const outputDBUrl = program.args[1]

async function exportTenantData() {
  logger.info(`Starting export for tenant ${tenantId}...`)
  const client = await getMongoDbClient(StackConstants.MONGO_DB_DATABASE_NAME)
  const inputDB = client.db()
  const outputDB = (await MongoClient.connect(outputDBUrl)).db()

  await copyCollections(
    client,
    tenantId,
    inputDB,
    tenantId,
    outputDB,
    anonymize
  )
}

exportTenantData()
  .then(() => exit(0))
  .catch((e) => {
    logger.error(e)
    exit(1)
  })
