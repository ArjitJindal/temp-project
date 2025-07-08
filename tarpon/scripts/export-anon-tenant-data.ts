import { exit } from 'process'
import { program } from 'commander'
import { MongoClient } from 'mongodb'

import { getMongoDbClient } from '@/utils/mongodb-utils'
import { logger } from '@/core/logger'
import { copyCollections } from '@/utils/seed'
import { anonymize } from '@/utils/anonymize'
import { getDynamoDbClient } from '@/utils/dynamodb'

program.argument('tenant ID').argument('output DB connection URL').parse()

const tenantId = program.args[0]
const outputDBUrl = program.args[1]

async function exportTenantData() {
  logger.info(`Starting export for tenant ${tenantId}...`)
  const client = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const inputDB = client.db()
  const outputDB = (await MongoClient.connect(outputDBUrl)).db()

  await copyCollections(
    client,
    dynamoDb,
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
