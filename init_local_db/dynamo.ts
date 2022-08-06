#!/usr/bin/env ts-node
import { execSync } from 'child_process'

import AWS from 'aws-sdk'

async function main() {
  new AWS.DynamoDB.DocumentClient({
    credentials: {
      accessKeyId: 'fake',
      secretAccessKey: 'fake',
    },
    endpoint: 'http://localhost:8000',
    region: 'local',
  })

  console.log('Create Dynamo tables')
  try {
    execSync(
      'npm_config_table=Hammerhead npm run create-local-ddb >/dev/null 2>&1'
    )
    execSync('npm_config_table=Tarpon npm run create-local-ddb >/dev/null 2>&1')
  } catch (e) {
    // ignore
  }
  console.log('Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
