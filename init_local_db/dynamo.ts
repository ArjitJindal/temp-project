#!/usr/bin/env ts-node
import { execSync } from 'child_process'
import _ from 'lodash'
import { TENANT } from './settings'
import usersData from './data/users'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { UserType } from '@/@types/user/user-type'

async function users() {
  const dynamoDb = getDynamoDbClient()
  const userRepo = new UserRepository(TENANT, {
    dynamoDb: dynamoDb,
  })
  for (const user of usersData) {
    await userRepo.saveUser(_.omit(user, '_id'), (user as any).type as UserType)
  }
}

async function main() {
  console.log('Create Dynamo tables')
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

  console.log('Create users')
  await users()

  console.log('Done')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
