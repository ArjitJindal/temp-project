// Example usage:
// ts-node verify-remote-transactions --api https://eu-1.api.flagright.com --jwt <get_jwt_from_console>

import path from 'path'
import { execSync } from 'child_process'
import fetch from 'node-fetch'

import fs from 'fs-extra'
import { omit } from 'lodash'
import { syncRulesLibrary } from '../migrations/always-run/sync-rules-library'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { FEATURES } from '@/@types/openapi-internal-custom/Feature'

process.env.ENV = 'local'

const configPath = path.join(__dirname, 'config.json')
const {
  api,
  jwt: rawJwt,
  transactionIds,
  ruleInstanceIds,
} = fs.readJSONSync(configPath, 'utf-8')
console.info(`Using config from "${configPath}"`)
console.info(`Will get ${transactionIds.length} transactions from "${api}"`)

const createdUsers = new Set<string>()
const jwt = rawJwt.replace(/^Bearer\s+/, '')

async function getRemoteRuleInstances(
  ruleInstanceIds: string[]
): Promise<RuleInstance[]> {
  const allRuleInstances: RuleInstance[] = await (
    await fetch(`${api}/console/rule_instances`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })
  ).json()
  return allRuleInstances
    .filter((ruleInstance) => ruleInstanceIds.includes(ruleInstance.id!))
    .map((ruleInstance) => ({
      ...ruleInstance,
      status: 'ACTIVE',
    }))
}

async function getRemoteTransaction(transactionId: string) {
  return (
    await fetch(`${api}/console/transactions/${transactionId}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })
  ).json()
}

async function getRemoteUser(userId: string) {
  const result = await (
    await Promise.race([
      fetch(`${api}/console/business/users/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }),
      fetch(`${api}/console/consumer/users/${userId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }),
    ])
  ).json()
  if (result.error) {
    return null
  }
  return result
}

async function createRuleInstancesLocally(ruleInstanceIds: string[]) {
  const ruleInstances = await getRemoteRuleInstances(ruleInstanceIds)
  const ruleInstanceRepository = new RuleInstanceRepository(
    FLAGRIGHT_TENANT_ID,
    {
      dynamoDb: getDynamoDbClient(),
    }
  )
  for (const ruleInstance of ruleInstances) {
    await ruleInstanceRepository.createOrUpdateRuleInstance(ruleInstance)
  }
  console.info(`Activated ${ruleInstanceIds.length} rule instances`)
}

async function createUserLocally(userId: string) {
  if (createdUsers.has(userId)) {
    return
  }
  const user = await getRemoteUser(userId)
  if (user) {
    await fetch(`http://localhost:3000/${user.type.toLowerCase()}/users`, {
      method: 'POST',
      headers: {
        'x-api-key': 'fake',
        'tenant-id': 'flagright',
      },
      body: JSON.stringify(
        omit(user, '_id', 'PartitionKeyID', 'SortKeyID', 'type')
      ),
    })
  }
  createdUsers.add(userId)
}

async function verifyTransactionLocally(transactionId: string) {
  const transaction = await getRemoteTransaction(transactionId)
  const { originUserId, destinationUserId } = transaction
  await createUserLocally(originUserId)
  await createUserLocally(destinationUserId)

  return await (
    await fetch(
      `http://localhost:3000/transactions?validateOriginUserId=false&validateDestinationUserId=false`,
      {
        method: 'POST',
        headers: {
          'x-api-key': 'fake',
          'tenant-id': 'flagright',
        },
        body: JSON.stringify(
          omit(
            transaction,
            '_id',
            'PartitionKeyID',
            'SortKeyID',
            'executedRules',
            'hitRules',
            'status',
            'events',
            'originUser',
            'destinationUser'
          )
        ),
      }
    )
  ).json()
}

async function main() {
  if (transactionIds.length === 0) {
    return
  }

  execSync('npm run recreate-local-ddb --table=Tarpon >/dev/null 2>&1')
  console.info('Recreated Tarpon DynamoDB table')

  const tenantRepo = new TenantRepository('flagright', {
    dynamoDb: getDynamoDbClient(),
  })
  await tenantRepo.createOrUpdateTenantSettings({
    features: FEATURES,
  })

  if (ruleInstanceIds.length > 0) {
    execSync('npm run recreate-local-ddb --table=TarponRule >/dev/null 2>&1')
    console.info('Recreated TarponRule DynamoDB table')
    await syncRulesLibrary()
    await createRuleInstancesLocally(ruleInstanceIds)
  }

  const results: any[] = []
  for (let i = 0; i < transactionIds.length; i += 1) {
    const result = await verifyTransactionLocally(transactionIds[i])
    const hit = result?.hitRules?.length > 0
    results.push(result)
    console.info(
      `${i + 1}. Verified transaction ${transactionIds[i]} (Hit: ${hit})`
    )
  }
  const outputPath = path.join(
    __dirname,
    '.output',
    `${new Date().toISOString()}.json`
  )
  fs.ensureFileSync(outputPath)
  fs.writeJsonSync(outputPath, results, { spaces: 2 })
  console.info(`\nDone. See results: ${outputPath}`)
}

main().catch((e) => console.error(e))
