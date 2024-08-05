#!/usr/bin/env ts-node
import { execSync } from 'child_process'
import { MongoClient } from 'mongodb'
import axios from 'axios'
import { seedMongo } from '@/core/seed/mongo'
import { seedDynamo } from '@/core/seed/dynamodb'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleService } from '@/services/rules-engine'

process.env.ENV = process.env.ENV || 'local'
const DB_NAME = `tarpon`
const TENANT = process.env.TENANT || 'flagright'

async function main() {
  console.info('Creating Clickhouse tables...')
  // Create Clickhouse database
  await axios.post(
    'http://localhost:8123/?query=CREATE%20DATABASE%20IF%20NOT%20EXISTS%20tarpon'
  )
  console.log('Creating Dynamo tables...')
  try {
    execSync('npm run recreate-local-ddb --table=Hammerhead >/dev/null 2>&1')
    execSync('npm run recreate-local-ddb --table=Tarpon >/dev/null 2>&1')
    execSync('npm run recreate-local-ddb --table=TarponRule >/dev/null 2>&1')
    execSync('npm run recreate-local-ddb --table=Transient >/dev/null 2>&1')
    execSync(
      'ENV=local ts-node scripts/migrations/always-run/sync-rules-library.ts'
    )
  } catch (e) {
    console.error(e)
  }
  console.info('Seeding DynamoDB...')
  const dynamoClient = getDynamoDbClient()
  await RuleService.syncRulesLibrary()
  await seedDynamo(dynamoClient, TENANT)

  console.info('Seeding MongoDB...')
  const client = await MongoClient.connect(
    `mongodb://localhost:27018/${DB_NAME}`
  )
  await seedMongo(client, TENANT)
  console.info('Closing up mongo client')
  await client.close()
  console.info('Closing up dynamo client')
  dynamoClient.destroy()
  console.info('Finished seeding!')
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
