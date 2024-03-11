import { last } from 'lodash'
import dayjs from '@flagright/lib/utils/dayjs'
import { migrateAllTenants } from '../utils/tenant'
import { migrateEntities } from '../utils/mongodb'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '../utils/migration-progress'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  SANCTIONS_SCREENING_DETAILS_COLLECTION,
  SANCTIONS_SEARCHES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getRiskLevelFromScore } from '@/services/risk-scoring/utils'
import { RulesEngineService } from '@/services/rules-engine'
import { RuleRepository } from '@/services/rules-engine/repositories/rule-repository'
import { SanctionsScreeningDetails } from '@/@types/openapi-internal/SanctionsScreeningDetails'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { logger } from '@/core/logger'

async function migrateTenant(tenant: Tenant) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()
  const rulesEngine = new RulesEngineService(tenant.id, dynamoDb, mongoDb)

  const usersRepository = new UserRepository(tenant.id, {
    mongoDb,
  })
  const ruleRepository = new RuleRepository(tenant.id, {
    dynamoDb,
  })
  const ruleInstanceRepository = new RuleInstanceRepository(tenant.id, {
    dynamoDb,
  })
  const riskRepository = new RiskRepository(tenant.id, { dynamoDb })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  const rules = await ruleRepository.getRulesByIds([
    'R-16',
    'R-32',
    'R-128',
    'R-169',
  ])
  const sanctionsScreeningDetailsCollection =
    db.collection<SanctionsScreeningDetails>(
      SANCTIONS_SCREENING_DETAILS_COLLECTION(tenant.id)
    )
  const riskClassificationValues =
    await riskRepository.getRiskClassificationValues()

  // Migrate user screening rules
  const migrationStartTime = dayjs().startOf('hour').valueOf()
  const userScreeningRuleInstances = ruleInstances.filter((ruleInstance) =>
    ['R-16', 'R-32', 'R-128'].includes(ruleInstance.ruleId!)
  )
  if (userScreeningRuleInstances.length > 0) {
    const userMigrationKey = `backfill-sanctions-screening-details-user__${tenant.id}`
    const userMigrationLastCompletedTimestamp =
      await getMigrationLastCompletedTimestamp(userMigrationKey)
    const usersCollection = db.collection<InternalUser>(
      USERS_COLLECTION(tenant.id)
    )
    const usersCursor = usersCollection
      .find({
        createdTimestamp: { $gt: userMigrationLastCompletedTimestamp ?? 0 },
      })
      .sort({ createdTimestamp: 1 })
    // Run once for all users
    await migrateEntities<InternalUser>(
      usersCursor,
      async (users) => {
        await Promise.all(
          users.map(async (user) => {
            const userRiskLevel = getRiskLevelFromScore(
              riskClassificationValues,
              user.drsScore?.drsScore ?? null
            )
            for (const ruleInstance of userScreeningRuleInstances) {
              const isOngoingScreening =
                Boolean(
                  Object.values(ruleInstance.riskLevelParameters ?? {}).find(
                    (parameters) => parameters?.ongoingScreening
                  )
                ) || Boolean(ruleInstance.parameters?.ongoingScreening)
              await rulesEngine.verifyRuleIdempotent({
                rule: rules.find((rule) => rule.id === ruleInstance.ruleId)!,
                ruleInstance,
                senderUser: user,
                senderUserRiskLevel: userRiskLevel,
                database: 'MONGODB',
                ongoingScreeningMode: isOngoingScreening,
              })
            }
          })
        )
        logger.info(`Migrated ${users.length} users`)

        await updateMigrationLastCompletedTimestamp(
          userMigrationKey,
          last(users)!.createdTimestamp
        )
      },
      { mongoBatchSize: 100, processBatchSize: 50 }
    )

    // Backfill other days
    for (const ruleInstance of userScreeningRuleInstances) {
      const isOngoingScreening =
        Boolean(
          Object.values(ruleInstance.riskLevelParameters ?? {}).find(
            (parameters) => parameters?.ongoingScreening
          )
        ) || Boolean(ruleInstance.parameters?.ongoingScreening)
      const initialScreeningAt = dayjs(ruleInstance.createdAt)
        .startOf('hour')
        .valueOf()
      await sanctionsScreeningDetailsCollection.updateMany(
        { lastScreenedAt: { $gte: migrationStartTime } },
        { $set: { lastScreenedAt: initialScreeningAt } }
      )
      const initialRecords = await sanctionsScreeningDetailsCollection
        .find()
        .toArray()
      if (isOngoingScreening && initialRecords.length > 0) {
        const daysToBackfill = dayjs().diff(dayjs(initialScreeningAt), 'day')
        for (let i = 1; i <= daysToBackfill; i++) {
          const lastScreenedAt = dayjs(initialScreeningAt)
            .add(i, 'day')
            .valueOf()
          await sanctionsScreeningDetailsCollection.insertMany(
            initialRecords.map((initialRecord) => ({
              ...initialRecord,
              lastScreenedAt,
              isNew: false,
              _id: undefined,
            }))
          )
          logger.info(`Backfilled for day ${dayjs(lastScreenedAt).format()}`)
        }
      }
    }
  }

  // Migrate transaction screening rule
  const transactionScreeningRule = rules.find((rule) => rule.id === 'R-169')
  const transactionScreeningRuleInstance = ruleInstances.find(
    (rule) => rule.ruleId === 'R-169'
  )
  if (transactionScreeningRuleInstance) {
    const sanctionsSearchCollection = db.collection(
      SANCTIONS_SEARCHES_COLLECTION(tenant.id)
    )
    await sanctionsSearchCollection.updateMany(
      { expiresAt: { $exists: true } },
      { $set: { expiresAt: dayjs().add(12, 'hour').valueOf() } }
    )
    const txMigrationKey = `backfill-sanctions-screening-details-tx__${tenant.id}`
    const txMigrationLastCompletedTimestamp =
      await getMigrationLastCompletedTimestamp(txMigrationKey)
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenant.id)
    )
    const transactionsCursor = transactionsCollection
      .find({
        $and: [
          {
            timestamp: {
              $gt:
                txMigrationLastCompletedTimestamp ??
                transactionScreeningRuleInstance.createdAt!,
            },
          },
          {
            $or: [
              { originUserId: undefined },
              { destinationUserId: undefined },
            ],
          },
        ],
      })
      .sort({ timestamp: 1 })
    await migrateEntities<InternalTransaction>(
      transactionsCursor,
      async (transactions) => {
        await Promise.all(
          transactions.map(async (transaction) => {
            await rulesEngine.verifyRuleIdempotent({
              rule: transactionScreeningRule,
              ruleInstance: transactionScreeningRuleInstance,
              senderUser: transaction.originUserId
                ? ((await usersRepository.getMongoUser(
                    transaction.originUserId
                  )) as any)
                : undefined,
              receiverUser: transaction.destinationUserId
                ? ((await usersRepository.getMongoUser(
                    transaction.destinationUserId
                  )) as any)
                : undefined,
              transaction,
              database: 'MONGODB',
            })
            await sanctionsScreeningDetailsCollection.updateMany(
              {
                transactionId: transaction.transactionId,
                ruleInstanceIds: transactionScreeningRuleInstance.id,
              },
              { $set: { lastScreenedAt: transaction.timestamp } }
            )
          })
        )

        logger.info(`Migrated ${transactions.length} transactions`)
        await updateMigrationLastCompletedTimestamp(
          txMigrationKey,
          last(transactions)!.timestamp
        )
      },
      { mongoBatchSize: 100, processBatchSize: 50 }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
