// Example usage:
// ts-node verify-remote-transactions --api https://eu-1.api.flagright.com --jwt <get_jwt_from_console>

import path from 'path'
import { execSync } from 'child_process'
import fs from 'fs-extra'
import { omit } from 'lodash'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { FLAGRIGHT_TENANT_ID } from '@/core/constants'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { RuleService } from '@/services/rules-engine'
import { apiFetch } from '@/utils/api-fetch'
import { TransactionWithRulesResult } from '@/@types/openapi-internal/TransactionWithRulesResult'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { TransactionEventWithRulesResult } from '@/@types/openapi-public/TransactionEventWithRulesResult'
import dayjs from '@/utils/dayjs'

process.env.ENV = 'local'

const configPath = path.join(__dirname, 'config.json')
const {
  api,
  jwt: rawJwt,
  transactionIds,
  ruleInstanceId,
} = fs.readJSONSync(configPath, 'utf-8')
console.info(`Using config from "${configPath}"`)
console.info(`Will get ${transactionIds.length} transactions from "${api}"`)

const createdUsers = new Set<string>()
const jwt = rawJwt.replace(/^Bearer\s+/, '')

async function getRemoteSettings() {
  return (
    await apiFetch<TenantSettings>(`${api}/console/tenants/settings`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })
  ).result
}

async function getRemoteRuleInstances(
  ruleInstanceIds: string[]
): Promise<RuleInstance[]> {
  const allRuleInstances: RuleInstance[] = (
    await apiFetch<RuleInstance[]>(`${api}/console/rule_instances`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    })
  ).result

  return allRuleInstances
    .filter(
      (ruleInstance) =>
        ruleInstance.id && ruleInstanceIds.includes(ruleInstance.id)
    )
    .map((ruleInstance) => ({
      ...ruleInstance,
      status: 'ACTIVE',
    }))
}

async function getRemoteTransaction(transactionId: string) {
  return (
    await apiFetch<InternalTransaction>(
      `${api}/console/transactions/${transactionId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    )
  ).result
}

async function getRemoteUser(userId: string) {
  try {
    const result = await apiFetch<InternalBusinessUser>(
      `${api}/console/business/users/${userId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    )
    return result.result
  } catch (e) {
    // continue
  }
  try {
    const result = await apiFetch<InternalConsumerUser>(
      `${api}/console/consumer/users/${userId}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    )
    return result.result
  } catch (e) {
    // continue
  }
  return null
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
    await apiFetch(`http://localhost:3000/${user.type.toLowerCase()}/users`, {
      method: 'POST',
      headers: {
        'x-api-key': 'fake',
        'tenant-id': 'flagright',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(
        omit(user, '_id', 'PartitionKeyID', 'SortKeyID', 'type')
      ),
    })
  }
  createdUsers.add(userId)
}

async function verifyTransactionLocally(transaction: InternalTransaction) {
  const { originUserId, destinationUserId } = transaction
  if (originUserId) {
    await createUserLocally(originUserId)
  }
  if (destinationUserId) {
    await createUserLocally(destinationUserId)
  }

  return (
    await apiFetch<TransactionWithRulesResult>(
      `http://localhost:3000/transactions?validateOriginUserId=false&validateDestinationUserId=false`,
      {
        method: 'POST',
        headers: {
          'x-api-key': 'fake',
          'tenant-id': 'flagright',
          'Content-Type': 'application/json',
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
  ).result
}

async function verifyTransactioEventLocally(
  transactionEvent: TransactionEventWithRulesResult
) {
  return (
    await apiFetch<TransactionWithRulesResult>(
      `http://localhost:3000/events/transaction`,
      {
        method: 'POST',
        headers: {
          'x-api-key': 'fake',
          'tenant-id': 'flagright',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          omit(
            transactionEvent,
            '_id',
            'PartitionKeyID',
            'SortKeyID',
            'executedRules',
            'hitRules',
            'status'
          )
        ),
      }
    )
  ).result
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
  const settings = await getRemoteSettings()
  await tenantRepo.createOrUpdateTenantSettings(settings)

  execSync('npm run recreate-local-ddb --table=TarponRule >/dev/null 2>&1')
  console.info('Recreated TarponRule DynamoDB table')
  await RuleService.syncRulesLibrary()
  await createRuleInstancesLocally([ruleInstanceId])

  const transactionsOrEvents: Array<
    InternalTransaction | TransactionEventWithRulesResult
  > = []
  const initialEvents: { [txId: string]: TransactionEventWithRulesResult } = {}
  await Promise.all(
    transactionIds.map(async (transactionId) => {
      const transaction = await getRemoteTransaction(transactionId)
      initialEvents[transactionId] = transaction
        .events?.[0] as TransactionEventWithRulesResult
      transactionsOrEvents.push(...(transaction.events?.slice(1) ?? []))
      transactionsOrEvents.push(transaction)
    })
  )
  transactionsOrEvents.sort(
    (a, b) => (a as any).createdAt - (b as any).createdAt
  )

  const results: any[] = []
  for (let i = 0; i < transactionsOrEvents.length; i += 1) {
    const txOrEvent = transactionsOrEvents[i]
    const isTxEvent = !!(txOrEvent as TransactionEventWithRulesResult)
      .updatedTransactionAttributes
    const time = dayjs(txOrEvent.timestamp).toISOString()
    const removeRuleHit = !!(
      isTxEvent ? txOrEvent : initialEvents[txOrEvent.transactionId]
    ).hitRules?.find((v) => v.ruleInstanceId === ruleInstanceId)
    let result: any
    if (isTxEvent) {
      const txEvent = txOrEvent as TransactionEventWithRulesResult
      result = await verifyTransactioEventLocally(txEvent)
    } else {
      const tx = txOrEvent as InternalTransaction
      result = await verifyTransactionLocally(tx)
    }
    const hit = result?.hitRules?.length > 0
    results.push(result)
    const entity = isTxEvent
      ? `tx event ${(
          txOrEvent as TransactionEventWithRulesResult
        ).eventId?.slice(-5)} (tx: ${txOrEvent.transactionId.slice(-5)})`
      : `tx ${txOrEvent.transactionId.slice(-5)}`
    console.info(
      `[${time}] Verified ${entity} - Hit: ${hit} (local) / ${removeRuleHit} (remote)`
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

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
