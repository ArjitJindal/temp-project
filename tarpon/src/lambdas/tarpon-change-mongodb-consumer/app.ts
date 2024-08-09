import path from 'path'
import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { difference, isEmpty, isEqual, omit, pick } from 'lodash'
import { StackConstants } from '@lib/constants'
import {
  TRANSACTION_EVENTS_COLLECTION,
  USER_EVENTS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { TransactionWithRulesResult } from '@/@types/openapi-public/TransactionWithRulesResult'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { logger } from '@/core/logger'
import {
  DbClients,
  StreamConsumerBuilder,
} from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import {
  tenantHasFeature,
  tenantSettings,
  updateLogMetadata,
} from '@/core/utils/context'
import { InternalTransactionEvent } from '@/@types/openapi-internal/InternalTransactionEvent'
import { isDemoTenant } from '@/utils/tenant'
import { DYNAMO_KEYS } from '@/core/seed/dynamodb'
import { insertToClickhouse } from '@/utils/clickhouse-utils'
import { UserWithRulesResult } from '@/@types/openapi-public/UserWithRulesResult'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessWithRulesResult } from '@/@types/openapi-public/BusinessWithRulesResult'
import { InternalConsumerUserEvent } from '@/@types/openapi-internal/InternalConsumerUserEvent'
import { InternalBusinessUserEvent } from '@/@types/openapi-internal/InternalBusinessUserEvent'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { CaseRepository } from '@/services/cases/repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RiskScoringService } from '@/services/risk-scoring'
import { filterLiveRules, runOnV8Engine } from '@/services/rules-engine/utils'
import { RuleJsonLogicEvaluator } from '@/services/rules-engine/v8-engine'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { getRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'
import { CaseCreationService } from '@/services/cases/case-creation-service'
import { UserService } from '@/services/users'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { envIsNot } from '@/utils/env'

export const INTERNAL_ONLY_USER_ATTRIBUTES = difference(
  InternalUser.getAttributeTypeMap().map((v) => v.name),
  UserWithRulesResult.getAttributeTypeMap().map((v) => v.name)
)

export const INTERNAL_ONLY_TX_ATTRIBUTES = difference(
  InternalTransaction.getAttributeTypeMap().map((v) => v.name),
  TransactionWithRulesResult.getAttributeTypeMap().map((v) => v.name)
)

async function userHandler(
  tenantId: string,
  oldUser: BusinessWithRulesResult | UserWithRulesResult | undefined,
  newUser: BusinessWithRulesResult | UserWithRulesResult | undefined,
  dbClients: DbClients
) {
  if (!newUser || !newUser.userId) {
    return
  }
  updateLogMetadata({ userId: newUser.userId })

  logger.info(`Processing User`)

  let internalUser = newUser as InternalUser
  const { mongoDb, dynamoDb } = dbClients
  const casesRepo = new CaseRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })

  const usersRepo = new UserRepository(tenantId, { mongoDb, dynamoDb })

  const settings = await tenantSettings(tenantId)

  const caseCreationService = new CaseCreationService(tenantId, {
    mongoDb,
    dynamoDb,
  })

  const riskRepository = new RiskRepository(tenantId, { dynamoDb })
  const isRiskScoringEnabled = settings?.features?.includes('RISK_SCORING')

  const isRiskLevelsEnabled = settings?.features?.includes('RISK_LEVELS')

  const [krsScore, drsScore] = await Promise.all([
    isRiskScoringEnabled
      ? riskRepository.getKrsScore(internalUser.userId)
      : null,
    isRiskScoringEnabled || isRiskLevelsEnabled
      ? riskRepository.getDrsScore(internalUser.userId)
      : null,
  ])

  if (!krsScore && isRiskScoringEnabled) {
    logger.warn(
      `KRS score not found for user ${internalUser.userId} for tenant ${tenantId}`
    )
  }

  internalUser = {
    ...internalUser,
    ...(krsScore && { krsScore }),
    ...(drsScore && { drsScore }),
  }

  const [_, existingUser] = await Promise.all([
    drsScore && isRiskScoringEnabled
      ? usersRepo.updateDrsScoreOfUser(internalUser.userId, drsScore)
      : null,
    usersRepo.getUserById(internalUser.userId),
  ])

  internalUser.createdAt = existingUser?.createdAt ?? Date.now()
  internalUser.updatedAt = Date.now()

  const savedUser = await usersRepo.saveUserMongo({
    ...pick(existingUser, INTERNAL_ONLY_USER_ATTRIBUTES),
    ...(omit(internalUser, DYNAMO_KEYS) as InternalUser),
  })

  const newHitRules = savedUser.hitRules?.filter(
    (hitRule) => !hitRule.ruleHitMeta?.isOngoingScreeningHit
  )
  // NOTE: This is a workaround to avoid creating redundant cases. In 748200a, we update
  // user.riskLevel in DynamoDB, but if a case was created for rule A and was closed, updating user.riskLevel
  // alone will trigger a new case which is unexpected. We only want to create a new case if the user details
  // have changes (when there're changes, we'll run user rules again).
  const userDetailsChanged = !isEqual(
    omit(oldUser, 'riskLevel'),
    omit(newUser, 'riskLevel')
  )
  if (userDetailsChanged && newHitRules?.length) {
    const timestampBeforeCasesCreation = Date.now()
    const cases = await caseCreationService.handleUser({
      ...savedUser,
      hitRules: newHitRules,
    })
    await caseCreationService.handleNewCases(
      tenantId,
      timestampBeforeCasesCreation,
      cases
    )
  }
  await casesRepo.syncCaseUsers(internalUser)

  if (!krsScore && isRiskScoringEnabled && !isDemoTenant(tenantId)) {
    // Will backfill KRS score for all users without KRS score
    await sendBatchJobCommand({
      type: 'PULSE_USERS_BACKFILL_RISK_SCORE',
      tenantId,
    })
  }
}

export const transactionHandler = async (
  tenantId: string,
  transaction: TransactionWithRulesResult | undefined,
  dbClients: DbClients
) => {
  if (!transaction || !transaction.transactionId || isDemoTenant(tenantId)) {
    return
  }
  updateLogMetadata({ transactionId: transaction.transactionId })
  logger.info(`Processing Transaction`)

  const { mongoDb, dynamoDb } = dbClients

  const transactionsRepo = new MongoDbTransactionRepository(tenantId, mongoDb)
  const casesRepo = new CaseRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })

  const ruleInstancesRepo = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })

  const riskScoringService = new RiskScoringService(tenantId, {
    dynamoDb,
    mongoDb,
  })

  const settings = await tenantSettings(tenantId)
  const isRiskScoringEnabled = await tenantHasFeature(tenantId, 'RISK_SCORING')

  const arsScore = isRiskScoringEnabled
    ? await riskScoringService.getArsScore(transaction.transactionId)
    : undefined

  if (isRiskScoringEnabled && !arsScore) {
    logger.error(
      `ARS score not found for transaction ${transaction.transactionId} for tenant ${tenantId}: Recalculating Async`
    )
  }

  const existingTransaction = await transactionsRepo.getTransactionById(
    transaction.transactionId
  )
  const [transactionInMongo, ruleInstances, deployingRuleInstances] =
    await Promise.all([
      transactionsRepo.addTransactionToMongo(
        {
          ...pick(existingTransaction, INTERNAL_ONLY_TX_ATTRIBUTES),
          ...(omit(transaction, DYNAMO_KEYS) as TransactionWithRulesResult),
        },
        arsScore
      ),
      ruleInstancesRepo.getRuleInstancesByIds(
        filterLiveRules({ hitRules: transaction.hitRules }).hitRules.map(
          (rule) => rule.ruleInstanceId
        )
      ),
      ruleInstancesRepo.getDeployingRuleInstances(),
    ])

  // Update rule aggregation data for the transactions created when the rule is still deploying
  if (deployingRuleInstances.length > 0) {
    const ruleLogicEvaluator = new RuleJsonLogicEvaluator(tenantId, dynamoDb)
    const transactionEventRepository = new TransactionEventRepository(
      tenantId,
      {
        dynamoDb,
      }
    )
    const transactionEvents =
      await transactionEventRepository.getTransactionEvents(
        transaction.transactionId
      )
    await Promise.all(
      deployingRuleInstances.map((ruleInstance) => {
        const rule = ruleInstance.ruleId
          ? getRuleByRuleId(ruleInstance.ruleId)
          : undefined

        if (!runOnV8Engine(ruleInstance, rule)) {
          return
        }

        return ruleLogicEvaluator.handleV8Aggregation(
          'RULES',
          ruleInstance.logicAggregationVariables ?? [],
          transaction,
          transactionEvents
        )
      })
    )
  }

  const caseCreationService = new CaseCreationService(tenantId, {
    mongoDb,
    dynamoDb,
  })

  const userService = new UserService(tenantId, { dynamoDb, mongoDb })

  const timestampBeforeCasesCreation = Date.now()

  const transactionUsers = await caseCreationService.getTransactionSubjects(
    transaction
  )

  const ruleWithAdvancedOptions = ruleInstances.filter(
    (ruleInstance) =>
      !isEmpty(ruleInstance.triggersOnHit) ||
      !isEmpty(ruleInstance.riskLevelsTriggersOnHit)
  )

  const cases = await caseCreationService.handleTransaction(
    transactionInMongo,
    ruleInstances as RuleInstance[],
    transactionUsers
  )

  const { ORIGIN, DESTINATION } = transactionUsers ?? {}
  if (
    ruleWithAdvancedOptions?.length &&
    (ORIGIN?.type === 'USER' || DESTINATION?.type === 'USER')
  ) {
    await userService.handleTransactionUserStatusUpdateTrigger(
      transaction,
      ruleInstances as RuleInstance[],
      ORIGIN?.type === 'USER' ? ORIGIN?.user : null,
      DESTINATION?.type === 'USER' ? DESTINATION?.user : null
    )
  }

  // We don't need to use `tenantHasSetting` because we already have settings from above and we can just check for the feature
  if (settings?.features?.includes('RISK_SCORING')) {
    logger.info(`Calculating ARS & DRS`)

    const { originDrsScore, destinationDrsScore } =
      await riskScoringService.updateDynamicRiskScores(transaction, !arsScore)

    logger.info(`Calculation of ARS & DRS Completed`)

    await casesRepo.updateDynamicRiskScores(
      transaction.transactionId,
      originDrsScore,
      destinationDrsScore
    )

    logger.info(`DRS Updated in Cases`)
  }

  await caseCreationService.handleNewCases(
    tenantId,
    timestampBeforeCasesCreation,
    cases
  )
}

async function userEventHandler(
  tenantId: string,
  userEvent: ConsumerUserEvent | BusinessUserEvent | undefined,
  dbClients: DbClients
) {
  if (!userEvent || !userEvent.eventId) {
    return
  }

  updateLogMetadata({
    userId: userEvent.userId,
    userEventId: userEvent.eventId,
  })
  logger.info(`Processing User Event`)

  const db = dbClients.mongoDb.db()
  const userEventCollection = db.collection<
    InternalConsumerUserEvent | InternalBusinessUserEvent
  >(USER_EVENTS_COLLECTION(tenantId))

  // TODO: Update user status: https://flagright.atlassian.net/browse/FDT-150
  await Promise.all([
    userEventCollection.replaceOne(
      { eventId: userEvent.eventId },
      {
        ...(omit(userEvent, DYNAMO_KEYS) as
          | InternalConsumerUserEvent
          | InternalBusinessUserEvent),
        createdAt: Date.now(),
      },
      { upsert: true }
    ),
    insertToClickhouse(USER_EVENTS_COLLECTION(tenantId), userEvent, tenantId),
  ])
}

async function transactionEventHandler(
  tenantId: string,
  transactionEvent: TransactionEvent | undefined,
  dbClients: DbClients
) {
  if (!transactionEvent || !transactionEvent.eventId) {
    return
  }

  updateLogMetadata({
    transactionId: transactionEvent.transactionId,
    eventId: transactionEvent.eventId,
  })
  logger.info(`Processing Transaction Event`)

  const db = dbClients.mongoDb.db()

  const transactionEventCollection = db.collection<InternalTransactionEvent>(
    TRANSACTION_EVENTS_COLLECTION(tenantId)
  )

  await Promise.all([
    transactionEventCollection.replaceOne(
      { eventId: transactionEvent.eventId },
      {
        ...(omit(transactionEvent, DYNAMO_KEYS) as InternalTransactionEvent),
        createdAt: Date.now(),
      },
      { upsert: true }
    ),
    insertToClickhouse(
      TRANSACTION_EVENTS_COLLECTION(tenantId),
      transactionEvent,
      tenantId
    ),
  ])
}

if (envIsNot('test') && !process.env.TARPON_QUEUE_URL) {
  throw new Error('TARPON_QUEUE_URL is not defined')
}

const tarponBuilder = new StreamConsumerBuilder(
  path.basename(__dirname) + '-tarpon',
  process.env.TARPON_QUEUE_URL ?? '',
  StackConstants.TARPON_DYNAMODB_TABLE_NAME
)
  .setTransactionHandler(
    (tenantId, oldTransaction, newTransaction, dbClients) =>
      transactionHandler(tenantId, newTransaction, dbClients)
  )
  .setUserHandler((tenantId, oldUser, newUser, dbClients) =>
    userHandler(tenantId, oldUser, newUser, dbClients)
  )
  .setUserEventHandler((tenantId, oldUserEvent, newUserEvent, dbClients) =>
    userEventHandler(tenantId, newUserEvent, dbClients)
  )
  .setTransactionEventHandler(
    (tenantId, oldTransactionEvent, newTransactionEvent, dbClients) =>
      transactionEventHandler(tenantId, newTransactionEvent, dbClients)
  )

// NOTE: If we handle more entites, please add `localDynamoDbChangeCaptureHandler(...)` to the corresponding
// place that updates the entity to make local work
const tarponKinesisHandler = tarponBuilder.buildKinesisStreamHandler()
const tarponSqsFanOutHandler = tarponBuilder.buildSqsFanOutHandler()

export const tarponChangeMongoDbHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    await tarponKinesisHandler(event)
  }
)

export const tarponQueueHandler = lambdaConsumer()(async (event: SQSEvent) => {
  await tarponSqsFanOutHandler(event)
})
