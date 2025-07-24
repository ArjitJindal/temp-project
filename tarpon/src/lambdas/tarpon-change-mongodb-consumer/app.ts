import path from 'path'
import { KinesisStreamEvent, SQSEvent } from 'aws-lambda'
import { difference, isEmpty, isEqual, omit, pick, uniq, compact } from 'lodash'
import { StackConstants } from '@lib/constants'
import {
  arsScoreEventHandler,
  avgArsScoreEventHandler,
  drsScoreEventHandler,
  krsScoreEventHandler,
} from '../hammerhead-change-mongodb-consumer/app'
import { NangoRepository } from '../../services/nango/repository'
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
import { isDemoTenant } from '@/utils/tenant'
import { UserWithRulesResult } from '@/@types/openapi-public/UserWithRulesResult'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessWithRulesResult } from '@/@types/openapi-public/BusinessWithRulesResult'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { CaseRepository } from '@/services/cases/repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { filterLiveRules, runOnV8Engine } from '@/services/rules-engine/utils'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'
import { CaseCreationService } from '@/services/cases/case-creation-service'
import { UserService } from '@/services/users'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RiskService } from '@/services/risk'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { envIsNot } from '@/utils/env'
import { CRMRecord } from '@/@types/openapi-internal/CRMRecord'
import { CRMRecordLink } from '@/@types/openapi-internal/CRMRecordLink'
import { addNewSubsegment, traceable } from '@/core/xray'
import { getAddedItems } from '@/utils/array'
import dayjs from '@/utils/dayjs'
import { AlertsQaSampling } from '@/@types/openapi-internal/AlertsQaSampling'
import { AlertsRepository } from '@/services/alerts/repository'
import { NotificationRepository } from '@/services/notifications/notifications-repository'
import { Notification } from '@/@types/openapi-internal/Notification'
import { LLMLogObject, linkLLMRequestClickhouse } from '@/utils/llms'
import { DYNAMO_KEYS } from '@/utils/dynamodb'
import { RiskClassificationHistory } from '@/@types/openapi-internal/RiskClassificationHistory'
import {
  applyNewVersion,
  updateInMongoWithVersionCheck,
} from '@/utils/downstream-version'

type RuleStats = {
  oldExecutedRules: ExecutedRulesResult[]
  newExecutedRules: ExecutedRulesResult[]
}

@traceable
export class TarponChangeMongoDbConsumer {
  private tarponKinesisHandler: (event: KinesisStreamEvent) => Promise<void>
  private tarponSqsFanOutHandler: (event: SQSEvent) => Promise<void>
  private tarponBuilder: StreamConsumerBuilder

  constructor() {
    this.tarponBuilder = this.createStreamConsumerBuilder()
    this.tarponKinesisHandler = this.tarponBuilder.buildKinesisStreamHandler()
    this.tarponSqsFanOutHandler = this.tarponBuilder.buildSqsFanOutHandler()
  }

  private createStreamConsumerBuilder(): StreamConsumerBuilder {
    return (
      new StreamConsumerBuilder(
        path.basename(__dirname) + '-tarpon',
        process.env.DOWNSTREAM_TARPON_QUEUE_URL ?? '',
        process.env.DOWNSTREAM_SECONDARY_TARPON_QUEUE_URL ?? '',
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
            this.handleTransaction(tenantId, newTransaction, dbClients)
        )
        .setUserHandler((tenantId, oldUser, newUser, dbClients) =>
          this.handleUser(tenantId, oldUser, newUser, dbClients)
        )
        .setUserEventHandler(
          (tenantId, oldUserEvent, newUserEvent, dbClients) =>
            this.handleUserEvent(tenantId, newUserEvent, dbClients)
        )
        .setTransactionEventHandler(
          (tenantId, oldTransactionEvent, newTransactionEvent, dbClients) =>
            this.handleTransactionEvent(
              tenantId,
              newTransactionEvent,
              dbClients
            )
        )
        .setTransactionsHandler(
          (tenantId, oldTransactions, newTransactions, dbClients) =>
            this.handleRuleStats(
              tenantId,
              {
                oldExecutedRules: oldTransactions.flatMap(
                  (t) => t?.executedRules ?? []
                ),
                newExecutedRules: newTransactions.flatMap(
                  (t) => t?.executedRules ?? []
                ),
              },
              dbClients
            )
        )
        .setUsersHandler((tenantId, oldUsers, newUsers, dbClients) =>
          this.handleRuleStats(
            tenantId,
            {
              oldExecutedRules: oldUsers.flatMap((u) => u?.executedRules ?? []),
              newExecutedRules: newUsers.flatMap((u) => u?.executedRules ?? []),
            },
            dbClients
          )
        )
        // Hammerhead Head change handlers
        .setArsScoreEventHandler(
          (tenantId, oldArsScore, newArsScore, dbClients) =>
            arsScoreEventHandler(tenantId, newArsScore, dbClients)
        )
        .setDrsScoreEventHandler(
          (tenantId, oldDrsScore, newDrsScore, dbClients) =>
            drsScoreEventHandler(tenantId, oldDrsScore, newDrsScore, dbClients)
        )
        .setKrsScoreEventHandler(
          (tenantId, oldKrsScore, newKrsScore, dbClients) =>
            krsScoreEventHandler(tenantId, newKrsScore, dbClients)
        )
        .setAvgArsScoreEventHandler(
          (tenantId, oldAvgArs, newAvgArs, dbClients) =>
            avgArsScoreEventHandler(tenantId, newAvgArs, dbClients)
        )
        .setCrmRecordHandler((tenantId, newCrmRecords, dbClients) =>
          this.handleCrmRecord(tenantId, newCrmRecords, dbClients)
        )
        .setCrmUserRecordLinkHandler(
          (tenantId, newCrmUserRecordLinks, dbClients) =>
            this.handleCrmUserRecordLink(
              tenantId,
              newCrmUserRecordLinks,
              dbClients
            )
        )
        .setAlertsQaSamplingHandler(
          (tenantId, oldAlertQaSampling, newAlertQaSampling, dbClients) =>
            this.handleAlertsQaSampling(tenantId, newAlertQaSampling, dbClients)
        )
        .setNotificationsHandler(
          (tenantId, oldNotifications, newNotifications, dbClients) =>
            this.handleNotifications(tenantId, newNotifications, dbClients)
        )
        .setLLMRequestsHandler((tenantId, newLLMRequests) =>
          this.handleLLMRequests(tenantId, newLLMRequests)
        )
        .setRiskClassificationHistoryHandler(
          (tenantId, newRiskClassificationHistory, dbClients) =>
            this.handleRiskClassificationHistory(
              tenantId,
              newRiskClassificationHistory,
              dbClients
            )
        )
    )
  }

  async handleKinesisStreamEvent(event: KinesisStreamEvent): Promise<void> {
    await this.tarponKinesisHandler(event)
  }

  async handleSqsEvent(event: SQSEvent): Promise<void> {
    await this.tarponSqsFanOutHandler(event)
  }

  async handleUser(
    tenantId: string,
    oldUser: BusinessWithRulesResult | UserWithRulesResult | undefined,
    newUser: BusinessWithRulesResult | UserWithRulesResult | undefined,
    dbClients: DbClients
  ): Promise<void> {
    if (!newUser || !newUser.userId) {
      return
    }
    const subSegment = await addNewSubsegment('StreamConsumer', 'handleUser')
    updateLogMetadata({ userId: newUser.userId })

    logger.info(`Processing User`)
    let internalUser = newUser as InternalUser
    const { mongoDb, dynamoDb } = dbClients
    const casesRepo = new CaseRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })

    const usersRepo = new UserRepository(tenantId, { mongoDb, dynamoDb })

    const existingUser = usersRepo.getUserById(newUser.userId)
    /*  version check before processing user*/
    if (!applyNewVersion(newUser, existingUser)) {
      return
    }
    const settings = await tenantSettings(tenantId)

    const caseCreationService = new CaseCreationService(tenantId, {
      mongoDb,
      dynamoDb,
    })

    const userService = new UserService(tenantId, {
      dynamoDb,
      mongoDb,
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

    if (drsScore) {
      await usersRepo.updateDrsScoreOfUser(internalUser.userId, drsScore)
    }
    const savedUser = await usersRepo.saveUserMongo({
      ...pick(existingUser, INTERNAL_ONLY_USER_ATTRIBUTES),
      ...(omit(internalUser, DYNAMO_KEYS) as InternalUser),
    })
    const newHitRules = savedUser.hitRules?.filter(
      (hitRule) => !hitRule.ruleHitMeta?.isOngoingScreeningHit
    )
    // NOTE: This is a workaround to avoid creating redundant cases. In 748200a, we update
    // user.riskLevel and user.kycRiskLevel in DynamoDB, but if a case was created for rule A and was closed, updating user.riskLevel or user.kycRiskLevel
    // alone will trigger a new case which is unexpected. We only want to create a new case if the user details
    // have changes (when there're changes, we'll run user rules again).
    const userDetailsChanged = !isEqual(
      omit(oldUser, ['riskLevel', 'kycRiskLevel']),
      omit(newUser, ['riskLevel', 'kycRiskLevel'])
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

    subSegment?.close()
  }

  async handleTransaction(
    tenantId: string,
    transaction: TransactionWithRulesResult | undefined,
    dbClients: DbClients
  ): Promise<void> {
    if (
      !transaction ||
      !transaction.transactionId ||
      (isDemoTenant(tenantId) && envIsNot('local'))
    ) {
      return
    }
    const subSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleTransaction'
    )
    updateLogMetadata({ transactionId: transaction.transactionId })
    logger.info(`Processing Transaction`)

    const { mongoDb, dynamoDb } = dbClients

    const transactionsRepo = new MongoDbTransactionRepository(
      tenantId,
      mongoDb,
      dynamoDb
    )

    const ruleInstancesRepo = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })

    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskRepository = new RiskRepository(tenantId, { dynamoDb, mongoDb })

    const settings = await tenantSettings(tenantId)
    const existingTransactionSubSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleTransaction existingTransaction'
    )
    const existingTransaction = await transactionsRepo.getTransactionById(
      transaction.transactionId
    )
    existingTransactionSubSegment?.close()

    const deployingRuleInstances =
      await ruleInstancesRepo.getDeployingRuleInstances()

    const isRiskScoringEnabled = settings.features?.includes('RISK_SCORING')
    const riskService = new RiskService(tenantId, {
      dynamoDb,
      mongoDb,
    })
    const deployingFactorsSubSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleTransaction deployingFactors'
    )
    const deployingFactors = isRiskScoringEnabled
      ? (await riskService.getAllRiskFactors()).filter(
          (factor) => factor.status === 'DEPLOYING'
        )
      : []
    deployingFactorsSubSegment?.close()
    // Update rule aggregation data for the transactions created when the rule is still deploying
    if (deployingRuleInstances.length > 0 || deployingFactors.length > 0) {
      const transactionEventRepository = new TransactionEventRepository(
        tenantId,
        {
          dynamoDb,
        }
      )

      const transactionEventsSubSegment = await addNewSubsegment(
        'StreamConsumer',
        'handleTransaction transactionEvents'
      )
      const transactionEvents =
        await transactionEventRepository.getTransactionEvents(
          transaction.transactionId
        )

      transactionEventsSubSegment?.close()

      const v8AggregationSubSegment = await addNewSubsegment(
        'StreamConsumer',
        'handleTransaction v8Aggregation'
      )
      await Promise.all([
        ...deployingRuleInstances.map(async (ruleInstance) => {
          if (!runOnV8Engine(ruleInstance)) {
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
      v8AggregationSubSegment?.close()
    }
    /* version check before saving txn to mongo and we should still update in txn aggregation regardless */
    if (!applyNewVersion(transaction, existingTransaction)) {
      return
    }
    const arsScoreSubSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleTransaction arsScore'
    )
    const arsScore = isRiskScoringEnabled
      ? await riskRepository.getArsScore(transaction.transactionId)
      : undefined

    arsScoreSubSegment?.close()

    const transactionInMongoSubSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleTransaction transactionInMongo'
    )
    const [transactionInMongo, ruleInstances] = await Promise.all([
      transactionsRepo.addTransactionToMongo(
        {
          ...pick(existingTransaction, INTERNAL_ONLY_TX_ATTRIBUTES),
          ...(omit(transaction, DYNAMO_KEYS) as TransactionWithRulesResult),
        },
        arsScore
      ),
      ruleInstancesRepo.getRuleInstancesByIds(
        filterLiveRules(
          { hitRules: transaction?.hitRules ?? [] },
          true
        )?.hitRules?.map((rule) => rule.ruleInstanceId) ?? []
      ),
    ])
    transactionInMongoSubSegment?.close()

    const caseCreationService = new CaseCreationService(tenantId, {
      mongoDb,
      dynamoDb,
    })

    const userService = new UserService(tenantId, { dynamoDb, mongoDb })

    const timestampBeforeCasesCreation = Date.now()

    const transactionUsersSubSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleTransaction transactionUsers'
    )
    const transactionUsers = await caseCreationService.getTransactionSubjects(
      transaction
    )
    transactionUsersSubSegment?.close()

    const ruleWithAdvancedOptions = ruleInstances.filter(
      (ruleInstance) =>
        !isEmpty(ruleInstance.triggersOnHit) ||
        !isEmpty(ruleInstance.riskLevelsTriggersOnHit)
    )

    const casesSubSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleTransaction cases'
    )
    const cases = await caseCreationService.handleTransaction(
      transactionInMongo,
      ruleInstances as RuleInstance[],
      transactionUsers
    )
    casesSubSegment?.close()
    const { ORIGIN, DESTINATION } = transactionUsers ?? {}
    if (
      ruleWithAdvancedOptions?.length &&
      (ORIGIN?.type === 'USER' || DESTINATION?.type === 'USER')
    ) {
      const userServiceSubSegment = await addNewSubsegment(
        'StreamConsumer',
        'handleTransaction handleUserStatusUpdateTrigger'
      )
      await userService.handleUserStatusUpdateTrigger(
        transaction?.hitRules ?? [],
        ruleInstances as RuleInstance[],
        ORIGIN?.type === 'USER' ? ORIGIN?.user : null,
        DESTINATION?.type === 'USER' ? DESTINATION?.user : null
      )
      userServiceSubSegment?.close()
    }

    const handleNewCasesSubSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleTransaction handleNewCases'
    )

    await caseCreationService.handleNewCases(
      tenantId,
      timestampBeforeCasesCreation,
      cases
    )
    handleNewCasesSubSegment?.close()
    subSegment?.close()
  }

  async handleUserEvent(
    tenantId: string,
    userEvent: ConsumerUserEvent | BusinessUserEvent | undefined,
    dbClients: DbClients
  ): Promise<void> {
    if (!userEvent || !userEvent.eventId) {
      return
    }
    const subSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleUserEvent'
    )

    updateLogMetadata({
      userId: userEvent.userId,
      userEventId: userEvent.eventId,
    })
    const requiredEvent = omit(userEvent, DYNAMO_KEYS)

    await updateInMongoWithVersionCheck(
      dbClients.mongoDb,
      USER_EVENTS_COLLECTION(tenantId),
      { eventId: userEvent.eventId },
      requiredEvent,
      true
    )
    subSegment?.close()
  }

  async handleCrmRecord(
    tenantId: string,
    newCrmRecord: CRMRecord,
    dbClients: DbClients
  ): Promise<void> {
    // if no demoTenant skip
    if (isDemoTenant(tenantId) && envIsNot('local')) {
      return
    }

    const userRepository = new UserRepository(tenantId, {
      mongoDb: dbClients.mongoDb,
    })

    const userIds = await userRepository.getUserIdsByEmails(
      compact(
        uniq([
          ...(newCrmRecord.data.record.email
            ? [newCrmRecord.data.record.email]
            : []),
          ...(newCrmRecord.data.record.ccEmails ?? []),
          ...(newCrmRecord.data.record.replyCcEmails ?? []),
          ...(newCrmRecord.data.record.fwdEmails ?? []),
        ])
      )
    )

    await new NangoRepository(
      tenantId,
      dbClients.dynamoDb
    ).storeRecordsClickhouse([newCrmRecord])

    for (const userId of userIds) {
      await new NangoRepository(
        tenantId,
        dbClients.dynamoDb
      ).linkCrmRecordClickhouse({
        crmName: newCrmRecord.crmName,
        recordType: newCrmRecord.data.recordType,
        id: newCrmRecord.data.record.id,
        userId,
        timestamp: dayjs().valueOf(),
      })
    }
  }

  async handleCrmUserRecordLink(
    tenantId: string,
    newCrmUserRecordLinks: CRMRecordLink,
    dbClients: DbClients
  ): Promise<void> {
    if (isDemoTenant(tenantId) && envIsNot('local')) {
      return
    }
    const nangoRepository = new NangoRepository(tenantId, dbClients.dynamoDb)
    await nangoRepository.linkCrmRecordClickhouse(newCrmUserRecordLinks)
  }

  async handleTransactionEvent(
    tenantId: string,
    transactionEvent: TransactionEvent | undefined,
    dbClients: DbClients
  ): Promise<void> {
    if (!transactionEvent || !transactionEvent.eventId) {
      return
    }
    const subSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleTransactionEvent'
    )

    updateLogMetadata({
      transactionId: transactionEvent.transactionId,
      eventId: transactionEvent.eventId,
    })
    logger.info(`Processing Transaction Event`)
    const requiredEvent = omit(transactionEvent, DYNAMO_KEYS)
    await updateInMongoWithVersionCheck(
      dbClients.mongoDb,
      TRANSACTION_EVENTS_COLLECTION(tenantId),
      { eventId: transactionEvent.eventId },
      requiredEvent,
      true
    )
    subSegment?.close()
  }

  async handleRuleStats(
    tenantId: string,
    data: RuleStats,
    dbClients: DbClients
  ): Promise<void> {
    const subSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleRuleStats'
    )

    const ruleInstanceRepository = new RuleInstanceRepository(
      tenantId,
      dbClients
    )

    const executedRulesInstanceIds = getAddedItems(
      data?.oldExecutedRules?.map((r) => r.ruleInstanceId) ?? [],
      data?.newExecutedRules?.map((r) => r.ruleInstanceId) ?? []
    )

    const hitRulesInstanceIds = getAddedItems(
      data?.oldExecutedRules
        ?.filter((r) => r.ruleHit)
        .map((r) => r.ruleInstanceId) ?? [],
      data?.newExecutedRules
        .filter((r) => r.ruleHit)
        .map((r) => r.ruleInstanceId) ?? []
    )

    await ruleInstanceRepository.updateRuleInstancesStats([
      { executedRulesInstanceIds, hitRulesInstanceIds },
    ])

    subSegment?.close()
  }

  async handleAlertsQaSampling(
    tenantId: string,
    newAlertQaSampling: AlertsQaSampling | undefined,
    dbClients: DbClients
  ): Promise<void> {
    if (!newAlertQaSampling) {
      return
    }
    const subSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleAlertsQaSampling'
    )
    const alertRepository = new AlertsRepository(tenantId, dbClients)
    await alertRepository.linkQaSamplingClickhouse(newAlertQaSampling)
    subSegment?.close()
  }

  async handleNotifications(
    tenantId: string,
    newNotifications: Notification | undefined,
    dbClients: DbClients
  ): Promise<void> {
    if (!newNotifications) {
      return
    }
    const subSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleNotifications'
    )
    const notificationsRepository = new NotificationRepository(
      tenantId,
      dbClients
    )
    await notificationsRepository.linkNotificationsToClickhouse([
      newNotifications,
    ])
    subSegment?.close()
  }

  async handleLLMRequests(
    tenantId: string,
    newLLMRequests: LLMLogObject | undefined
  ): Promise<void> {
    if (!newLLMRequests) {
      return
    }
    const subSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleGptRequests'
    )
    await linkLLMRequestClickhouse(tenantId, newLLMRequests)
    subSegment?.close()
  }

  async handleRiskClassificationHistory(
    tenantId: string,
    newRiskClassificationHistory: RiskClassificationHistory | undefined,
    dbClients: DbClients
  ): Promise<void> {
    if (!newRiskClassificationHistory) {
      return
    }
    const subSegment = await addNewSubsegment(
      'StreamConsumer',
      'handleRiskClassificationHistory'
    )

    const riskClassificationHistoryRepository = new RiskRepository(
      tenantId,
      dbClients
    )
    await riskClassificationHistoryRepository.createRiskClassificationHistoryInClickhouse(
      newRiskClassificationHistory
    )

    subSegment?.close()
  }
}

// Create a singleton instance
const consumer = new TarponChangeMongoDbConsumer()

// Update the exported lambda handlers to use the class methods
export const tarponChangeMongoDbHandler = lambdaConsumer()(
  async (event: KinesisStreamEvent) => {
    await consumer.handleKinesisStreamEvent(event)
  }
)

export const tarponQueueHandler = lambdaConsumer()(async (event: SQSEvent) => {
  await consumer.handleSqsEvent(event)
})

// Export the helper functions and constants for use elsewhere
export const INTERNAL_ONLY_USER_ATTRIBUTES = difference(
  InternalUser.getAttributeTypeMap().map((v) => v.name),
  UserWithRulesResult.getAttributeTypeMap().map((v) => v.name)
)

export const INTERNAL_ONLY_TX_ATTRIBUTES = difference(
  InternalTransaction.getAttributeTypeMap().map((v) => v.name),
  TransactionWithRulesResult.getAttributeTypeMap().map((v) => v.name)
)
