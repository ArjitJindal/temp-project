#!/usr/bin/env ts-node
import { execSync } from 'child_process'
import { TENANT } from './settings'
import { seedDynamo } from '@/core/seed/dynamodb'
import { getDynamoDbClient } from '@/utils/dynamodb'

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

  console.log('Creating users...')
  await seedDynamo(getDynamoDbClient(), TENANT)

  console.log('Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
