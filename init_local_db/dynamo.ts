#!/usr/bin/env ts-node
import { execSync } from 'child_process'

async function main() {
  console.log('Create Dynamo tables')
  try {
    execSync('npm run recreate-local-ddb --table=Hammerhead >/dev/null 2>&1')
    execSync('npm run recreate-local-ddb --table=Tarpon >/dev/null 2>&1')
    execSync('npm run recreate-local-ddb --table=TarponRule >/dev/null 2>&1')
    execSync('npm run recreate-local-ddb --table=Transient >/dev/null 2>&1')
    execSync(
      'ENV=local DYNAMODB_URI=http://localhost:8000 ts-node scripts/migrations/always-run/sync-rules-library.ts'
    )
  } catch (e) {
    console.error(e)
  }
  console.log('Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
