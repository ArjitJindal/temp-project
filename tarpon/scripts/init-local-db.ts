#!/usr/bin/env ts-node
import { execSync } from 'child_process'
import { MongoClient } from 'mongodb'
import { seedMongo } from '@/core/seed/mongo'
import { seedDynamo } from '@/core/seed/dynamodb'
import { getDynamoDbClient } from '@/utils/dynamodb'

process.env.ENV = process.env.ENV || 'local'
const DB_NAME = `tarpon`
const TENANT = process.env.TENANT || 'flagright'

async function main() {
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
  await seedDynamo(getDynamoDbClient(), TENANT)

  console.info('Seeding MongoDB...')
  const client = await MongoClient.connect(
    `mongodb://localhost:27018/${DB_NAME}`
  )
  await seedMongo(client, TENANT)
  console.info('Closing up mongo client')
  await client.close()
  console.info('Finished seeding!')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
