import path from 'path'
import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { difference, isEmpty, isEqual, omit, pick } from 'lodash'
import { StackConstants } from '@lib/constants'
import {
  arsScoreEventHandler,
  avgArsScoreEventHandler,
  drsScoreEventHandler,
  krsScoreEventHandler,
} from '../hammerhead-change-mongodb-consumer/app'
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
import { tenantSettings, updateLogMetadata } from '@/core/utils/context'
import { InternalTransactionEvent } from '@/@types/openapi-internal/InternalTransactionEvent'
import { isDemoTenant } from '@/utils/tenant'
import { DYNAMO_KEYS } from '@/core/seed/dynamodb'
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
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { internalMongoReplace } from '@/utils/mongodb-utils'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RiskService } from '@/services/risk'
import { RiskScoringV8Service } from '@/services/risk-scoring/risk-scoring-v8-service'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
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
  const userService = new UserService(tenantId, {
    dynamoDb,
    mongoDb,
  })
  const ruleInstancesRepo = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })

  if (!isEqual(oldUser?.hitRules, newUser?.hitRules)) {
    /* Comparing hit rules to avoid a loop being created */
    const ruleInstances = await ruleInstancesRepo.getRuleInstancesByIds(
      filterLiveRules({ hitRules: internalUser.hitRules }, true).hitRules.map(
        (rule) => rule.ruleInstanceId
      )
    )
    await userService.handleUserStatusUpdateTrigger(
      internalUser.hitRules as HitRulesDetails[],
      ruleInstances,
      internalUser,
      null // Only sending it for one direction to avoid updating twice
    )
    const updatedUser = await usersRepo.getUser<InternalUser>(
      internalUser.userId
    )

    internalUser = {
      ...internalUser,
      ...UserUpdateRequest.getAttributeTypeMap().reduce((acc, key) => {
        if (updatedUser?.[key.name]) {
          acc[key.name] = updatedUser?.[key.name]
        }
        return acc
      }, {} as InternalUser),
    }
  }

  internalUser = {
    ...internalUser,
    ...(krsScore && { krsScore }),
    ...(drsScore && { drsScore }),
  }

  const [_, existingUser] = await Promise.all([
    drsScore
      ? usersRepo.updateDrsScoreOfUser(internalUser.userId, drsScore)
      : null,
    usersRepo.getUserById(internalUser.userId),
  ])
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
      parameters: { userIds: [internalUser.userId] },
    })
  }
}

export const transactionHandler = async (
  tenantId: string,
  transaction: TransactionWithRulesResult | undefined,
  dbClients: DbClients
) => {
  if (
    !transaction ||
    !transaction.transactionId ||
    (isDemoTenant(tenantId) && envIsNot('local'))
  ) {
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

  const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
  const riskScoringService = new RiskScoringService(tenantId, {
    dynamoDb,
    mongoDb,
  })

  const settings = await tenantSettings(tenantId)
  const isRiskScoringEnabled = settings.features?.includes('RISK_SCORING')
  const v8RiskScoringEnabled = settings.features?.includes('RISK_SCORING_V8')
  const arsScore =
    isRiskScoringEnabled || v8RiskScoringEnabled
      ? await riskScoringService.getArsScore(transaction.transactionId)
      : undefined

  if ((v8RiskScoringEnabled || isRiskScoringEnabled) && !arsScore) {
    logger.error(`ARS score not found for transaction. Recalculating async`)
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
        filterLiveRules({ hitRules: transaction.hitRules }, true).hitRules.map(
          (rule) => rule.ruleInstanceId
        )
      ),
      ruleInstancesRepo.getDeployingRuleInstances(),
    ])
  const riskService = new RiskService(tenantId, {
    dynamoDb,
    mongoDb,
  })
  const deployingFactors = v8RiskScoringEnabled
    ? (await riskService.getAllRiskFactors()).filter(
        (factor) => factor.status === 'DEPLOYING'
      )
    : []

  // Update rule aggregation data for the transactions created when the rule is still deploying
  if (deployingRuleInstances.length > 0 || deployingFactors.length > 0) {
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
    await Promise.all([
      ...deployingRuleInstances.map(async (ruleInstance) => {
        const rule = ruleInstance.ruleId
          ? getRuleByRuleId(ruleInstance.ruleId)
          : undefined

        if (!runOnV8Engine(ruleInstance, rule)) {
          return
        }
        await logicEvaluator.handleV8Aggregation(
          'RULES',
          ruleInstance.logicAggregationVariables ?? [],
          transaction,
          transactionEvents
        )
      }),
      ...deployingFactors.map(async (factor) => {
        await logicEvaluator.handleV8Aggregation(
          'RISK',
          factor.logicAggregationVariables ?? [],
          transaction,
          transactionEvents
        )
      }),
    ])
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
    await userService.handleUserStatusUpdateTrigger(
      transaction.hitRules,
      ruleInstances as RuleInstance[],
      ORIGIN?.type === 'USER' ? ORIGIN?.user : null,
      DESTINATION?.type === 'USER' ? DESTINATION?.user : null
    )
  }

  // We don't need to use `tenantHasSetting` because we already have settings from above and we can just check for the feature
  if (isRiskScoringEnabled) {
    if (v8RiskScoringEnabled) {
      const riskScoringV8Service = new RiskScoringV8Service(
        tenantId,
        logicEvaluator,
        {
          dynamoDb,
          mongoDb,
        }
      )
      const [originDrsScore, destinationDrsScore] = await Promise.all([
        ORIGIN?.type === 'USER'
          ? riskScoringV8Service.getDrsScore(ORIGIN.user.userId)
          : Promise.resolve(undefined),
        DESTINATION?.type === 'USER'
          ? riskScoringV8Service.getDrsScore(DESTINATION.user.userId)
          : Promise.resolve(undefined),
      ])
      await casesRepo.updateDynamicRiskScores(
        transaction.transactionId,
        originDrsScore?.drsScore,
        destinationDrsScore?.drsScore
      )
      logger.info(`DRS Updated in Cases`)
    } else {
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

  await internalMongoReplace(
    dbClients.mongoDb,
    USER_EVENTS_COLLECTION(tenantId),
    { eventId: userEvent.eventId },
    {
      ...(omit(userEvent, DYNAMO_KEYS) as
        | InternalConsumerUserEvent
        | InternalBusinessUserEvent),
      createdAt: Date.now(),
    }
  )
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

  await internalMongoReplace(
    dbClients.mongoDb,
    TRANSACTION_EVENTS_COLLECTION(tenantId),
    { eventId: transactionEvent.eventId },
    {
      ...(omit(transactionEvent, DYNAMO_KEYS) as InternalTransactionEvent),
      createdAt: Date.now(),
    }
  )
}

export async function ruleStatsHandler(
  tenantId: string,
  executedRules: Array<ExecutedRulesResult>,
  dbClients: DbClients
) {
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb: dbClients.dynamoDb,
  })
  await ruleInstanceRepository.updateRuleInstancesStats([
    {
      executedRulesInstanceIds: executedRules.map((r) => r.ruleInstanceId),
      hitRulesInstanceIds: executedRules
        .filter((r) => r.ruleHit)
        .map((r) => r.ruleInstanceId),
    },
  ])
}

const tarponBuilder = new StreamConsumerBuilder(
  path.basename(__dirname) + '-tarpon',
  process.env.TARPON_QUEUE_URL ?? '',
  StackConstants.TARPON_DYNAMODB_TABLE_NAME
)
  .setConcurrentGroupBy((update) => {
    // We still process entities sequentially as it involes case creation
    if (update.type === 'TRANSACTION' || update.type === 'USER') {
      return 'sequential-group'
    }
    // For events, we can process them concurrently
    return update.entityId ?? ''
  })
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
  .setTransactionsHandler((tenantId, newTransactions, dbClients) =>
    ruleStatsHandler(
      tenantId,
      newTransactions.flatMap((t) => t.executedRules),
      dbClients
    )
  )
  .setUsersHandler((tenantId, newUsers, dbClients) =>
    ruleStatsHandler(
      tenantId,
      newUsers.flatMap((u) => u.executedRules ?? []),
      dbClients
    )
  )
  // Hammerhead Head change handlers
  .setConcurrentGroupBy((update) => update.entityId ?? '')
  .setArsScoreEventHandler((tenantId, oldArsScore, newArsScore, dbClients) =>
    arsScoreEventHandler(tenantId, newArsScore, dbClients)
  )
  .setDrsScoreEventHandler((tenantId, oldDrsScore, newDrsScore, dbClients) =>
    drsScoreEventHandler(tenantId, oldDrsScore, newDrsScore, dbClients)
  )
  .setKrsScoreEventHandler((tenantId, oldKrsScore, newKrsScore, dbClients) =>
    krsScoreEventHandler(tenantId, newKrsScore, dbClients)
  )
  .setAvgArsScoreEventHandler((tenantId, oldAvgArs, newAvgArs, dbClients) =>
    avgArsScoreEventHandler(tenantId, newAvgArs, dbClients)
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
