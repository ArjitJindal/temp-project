// Example usage:
// ts-node verify-remote-transactions --api https://eu-1.api.flagright.com --jwt <get_jwt_from_console>

import path from 'path'
import { execSync } from 'child_process'
import fs from 'fs-extra'
import { omit } from 'lodash'
import { PutCommand, PutCommandInput } from '@aws-sdk/lib-dynamodb'
import { StackConstants } from '@lib/constants'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { RuleService } from '@/services/rules-engine'
import { apiFetch } from '@/utils/api-fetch'
import { TransactionWithRulesResult } from '@/@types/openapi-internal/TransactionWithRulesResult'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { TransactionEventWithRulesResult } from '@/@types/openapi-public/TransactionEventWithRulesResult'
import dayjs from '@/utils/dayjs'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'

process.env.ENV = 'local'

const configPath = path.join(__dirname, 'config.json')
const {
  api,
  jwt: rawJwt,
  transactionIds,
  userIds,
  ruleInstanceIds,
} = fs.readJSONSync(configPath, 'utf-8') as {
  api: string
  jwt: string
  transactionIds: string[]
  userIds: string[]
  ruleInstanceIds: string[]
}
console.info(`Using config from "${configPath}"`)
console.info(`Will get ${transactionIds.length} transactions from ${api}`)
console.info(`Will get ${userIds.length} users from ${api}`)

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
      `${api}/console/transactions/${encodeURIComponent(transactionId)}`,
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
      `${api}/console/users/${encodeURIComponent(userId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${jwt}`,
        },
      }
    )
    return result.result
  } catch (e) {
    return null
  }
}

async function createRuleInstancesLocally(ruleInstanceIds: string[]) {
  const ruleInstances = await getRemoteRuleInstances(ruleInstanceIds)
  const dynamoDb = getDynamoDbClient()
  for (const ruleInstance of ruleInstances) {
    if (ruleInstance.type === 'USER') {
      ruleInstance.userRuleRunCondition = { entityUpdated: true }
    }
    const putItemInput: PutCommandInput = {
      TableName: StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME,
      Item: {
        ...DynamoDbKeys.RULE_INSTANCE('flagright', ruleInstance.id),
        ...ruleInstance,
      },
    }
    await dynamoDb.send(new PutCommand(putItemInput))
  }
  console.info(`Activated ${ruleInstanceIds.length} rule instances`)
}

async function createUserLocally(userId: string) {
  if (createdUsers.has(userId)) {
    return
  }
  const user = await getRemoteUser(userId)
  if (user) {
    return (
      await apiFetch<UserWithRulesResult>(
        `http://localhost:3000/${user.type.toLowerCase()}/users`,
        {
          method: 'POST',
          headers: {
            'x-api-key': 'fake',
            'tenant-id': 'flagright',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(
            omit(user, '_id', 'PartitionKeyID', 'SortKeyID', 'type')
          ),
        }
      )
    ).result
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

async function verifyTransactionEventLocally(
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
  if (transactionIds.length === 0 && userIds.length === 0) {
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
  await createRuleInstancesLocally(ruleInstanceIds)

  const results: any[] = []

  // Users
  for (const userId of userIds) {
    const result = await createUserLocally(userId)
    const hit = Boolean(
      result?.hitRules?.length && result?.hitRules?.length > 0
    )
    results.push(result)
    console.info(`Verified user - Hit: ${hit} (local) `)
  }

  // Transactions
  if (transactionIds.length) {
    const transactionsOrEvents: Array<
      InternalTransaction | TransactionEventWithRulesResult
    > = []
    const initialEvents: { [txId: string]: TransactionEventWithRulesResult } =
      {}
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

    for (let i = 0; i < transactionsOrEvents.length; i += 1) {
      const txOrEvent = transactionsOrEvents[i]
      const isTxEvent = !!(txOrEvent as TransactionEventWithRulesResult).eventId
      const time = dayjs(txOrEvent.timestamp).toISOString()
      const remoteRuleHit = !!(
        isTxEvent ? txOrEvent : initialEvents[txOrEvent.transactionId]
      ).hitRules?.find((v) => ruleInstanceIds.includes(v.ruleInstanceId))
      let result: any
      if (isTxEvent) {
        const txEvent = txOrEvent as TransactionEventWithRulesResult
        try {
          result = await verifyTransactionEventLocally(txEvent)
        } catch (e) {
          console.error(
            `[${time}] Failed to verify tx event ${txEvent.eventId}`
          )
          continue
        }
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
        `[${time}] Verified ${entity} - Hit: ${hit} (local) / ${remoteRuleHit} (remote)`
      )
    }
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
