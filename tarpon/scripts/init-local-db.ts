#!/usr/bin/env ts-node
import { execSync } from 'child_process'
import axios from 'axios'
import { initializeEnvVars } from './migrations/utils/config'
import { RuleService } from '@/services/rules-engine'
import { seedDemoData } from '@/core/seed'

process.env.ENV = process.env.ENV || 'local'
const TENANT = process.env.TENANT || 'flagright'

async function main() {
  initializeEnvVars()
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
  await RuleService.syncRulesLibrary()
  await seedDemoData(TENANT)
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
