import pick from 'lodash/pick'
import { StackConstants } from '@lib/constants'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { logger } from '../logger'
import { hasFeature } from '../utils/context'
import { DynamoDbKeys } from '../dynamodb/dynamodb-keys'
import { getCases } from './data/cases'
import { getCrmRecords, getCrmUserRecordLinks } from './data/crm-records'
import { riskFactors } from './data/risk-factors'
import { getNotifications } from './data/notifications'
import { auditlogs } from './data/auditlogs'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { users } from '@/core/seed/data/users'
import { UserType } from '@/@types/user/user-type'
import { data as listsData } from '@/core/seed/data/lists'
import { ListRepository } from '@/services/list/repositories/list-repository'
import {
  getTransactions,
  internalToPublic,
} from '@/core/seed/data/transactions'
import { DynamoDbTransactionRepository } from '@/services/rules-engine/repositories/dynamodb-transaction-repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { ruleInstances } from '@/core/seed/data/rules'
import { disableLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { DYNAMO_ONLY_USER_ATTRIBUTES } from '@/services/users/utils/user-utils'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import {
  getArsScores,
  getDrsScores,
  getKrsScores,
} from '@/core/seed/data/ars_scores'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import {
  BatchWriteRequestInternal,
  dangerouslyDeletePartition,
  batchWrite,
} from '@/utils/dynamodb'
import { NangoRepository } from '@/services/nango/repository'
import { RISK_FACTORS } from '@/services/risk-scoring/risk-factors'
import { DynamoCaseRepository } from '@/services/cases/dynamo-repository'
import { DynamoAlertRepository } from '@/services/alerts/dynamo-repository'
import { DynamoCounterRepository } from '@/services/counter/dynamo-repository'
import { getCounterCollectionData } from '@/core/seed/data/counter'
import { DynamoAuditLogRepository } from '@/services/audit-log/repositories/dynamo-repository'
import { getQASamples } from '@/core/seed/samplers/qa-samples'
import { DynamoNotificationRepository } from '@/services/notifications/dynamo-repository'
import { getDefaultReasonsData } from '@/services/tenants/reasons-service'
import { DynamoReasonsRepository } from '@/services/tenants/repositories/reasons/dynamo-repository'
import { handleSmallNumber } from '@/utils/helpers'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { getTriggerSource } from '@/utils/lambda'
import { getAggregatedRuleStatus } from '@/services/rules-engine/utils'
import { data as transactionEvents } from '@/core/seed/data/transaction_events'
import { getUserEvents } from '@/core/seed/data/user_events'

export async function seedDynamo(
  dynamoDb: DynamoDBDocumentClient,
  tenantId: string
) {
  logger.info('Seeding DynamoDB...')
  disableLocalChangeHandler()

  const userRepo = new UserRepository(tenantId, {
    dynamoDb: dynamoDb,
  })
  const listRepo = new ListRepository(tenantId, dynamoDb)
  const txnRepo = new DynamoDbTransactionRepository(tenantId, dynamoDb)
  const ruleRepo = new RuleInstanceRepository(tenantId, { dynamoDb })
  const nangoRepo = new NangoRepository(tenantId, dynamoDb)
  const dynamoCaseRepository = new DynamoCaseRepository(tenantId, dynamoDb)
  const dynamoAlertRepository = new DynamoAlertRepository(tenantId, dynamoDb)
  const dynamoNotificationRepository = new DynamoNotificationRepository(
    tenantId,
    dynamoDb
  )
  const riskRepo = new RiskRepository(tenantId, {
    dynamoDb,
  })

  const writeRequests: { [tableName: string]: BatchWriteRequestInternal[] } = {}

  const pushWriteRequest = (
    tableName: string,
    putItemInput: BatchWriteRequestInternal
  ) => {
    if (!writeRequests[tableName]) {
      writeRequests[tableName] = []
    }
    writeRequests[tableName].push(putItemInput)
  }

  logger.info(`Feature Chainalysis enabled ${hasFeature('CHAINALYSIS')}`)

  // rule stats
  const ruleStatsUpdateStartTime = Date.now()
  const ruleInstanceExecutionStats: {
    [ruleInstanceId: string]: { hitCount: number; runCount: number }
  } = {}

  const allEntities = [
    ...getTransactions(),
    ...users,
    ...transactionEvents(),
    ...getUserEvents(),
  ]
  allEntities.forEach((entity) => {
    entity.executedRules?.forEach((rule) => {
      if (rule.ruleInstanceId) {
        if (!ruleInstanceExecutionStats[rule.ruleInstanceId]) {
          ruleInstanceExecutionStats[rule.ruleInstanceId] = {
            hitCount: 0,
            runCount: 0,
          }
        }
        ruleInstanceExecutionStats[rule.ruleInstanceId].runCount++
      }
    })
    entity.hitRules?.forEach((rule) => {
      if (rule.ruleInstanceId) {
        if (!ruleInstanceExecutionStats[rule.ruleInstanceId]) {
          ruleInstanceExecutionStats[rule.ruleInstanceId] = {
            hitCount: 0,
            runCount: 0,
          }
        }
        ruleInstanceExecutionStats[rule.ruleInstanceId].hitCount++
      }
    })
  })

  logger.info(
    `TIME: DynamoDB: Rule stats calculation took ~ ${
      Date.now() - ruleStatsUpdateStartTime
    }`
  )

  // rule instances
  logger.info('Clear rule instances')
  await dangerouslyDeletePartition(
    dynamoDb,
    tenantId,
    DynamoDbKeys.RULE_INSTANCE(tenantId).PartitionKeyID,
    StackConstants.TARPON_RULE_DYNAMODB_TABLE_NAME
  )
  logger.info('Create rule instances')
  const allRuleInstances = ruleInstances()
  for (const ruleInstance of allRuleInstances) {
    let ruleInstanceExecutionStat = { hitCount: 0, runCount: 0 }
    if (ruleInstance.id) {
      ruleInstanceExecutionStat = ruleInstanceExecutionStats[ruleInstance.id]
    }
    console.log(
      'ruleInstanceExecutionStat',
      ruleInstance.id,
      ruleInstanceExecutionStat
    )
    const { putItemInput, tableName: ruleInstanceTableName } =
      await ruleRepo.createOrUpdateDemoRuleInstance(ruleInstance)
    pushWriteRequest(ruleInstanceTableName, {
      PutRequest: {
        Item: {
          ...putItemInput.PutRequest.Item,
          ...ruleInstanceExecutionStat,
        },
      },
    })
  }

  // users
  logger.info('Creating users...')
  const usersCreationStartTime = Date.now()
  for (const user of users) {
    const type = user.type as UserType
    const dynamoUser = pick<UserWithRulesResult | BusinessWithRulesResult>(
      user,
      DYNAMO_ONLY_USER_ATTRIBUTES
    ) as UserWithRulesResult | BusinessWithRulesResult

    const { putItemInput, tableName } = await userRepo.saveDemoUser(
      dynamoUser,
      type
    )
    pushWriteRequest(tableName, putItemInput)
  }
  logger.info(
    `TIME: DynamoDB: Users creation took ~ ${
      Date.now() - usersCreationStartTime
    }`
  )

  // lists
  logger.info('Clear lists instance...')
  await dangerouslyDeletePartition(
    dynamoDb,
    tenantId,
    DynamoDbKeys.LIST_HEADER(tenantId).PartitionKeyID,
    StackConstants.TARPON_DYNAMODB_TABLE_NAME(tenantId),
    'Lists'
  )
  // not including in batch write as we for a list we are writing multiple partition
  // as batch write don't gaurantee order of writes
  logger.info('Creating lists...')
  for (const list of listsData()) {
    await listRepo.createList(
      list.listType,
      list.subtype,
      list.data,
      list.listId
    )
  }

  // crm records
  const records = getCrmRecords()
  const crmUserRecordLinks = getCrmUserRecordLinks()
  // storing the records before linking, not doing in batch write due to order of writes
  await nangoRepo.storeRecord(records)
  for (const crmUserRecordLink of crmUserRecordLinks) {
    const { putItemInput, tableName: crmUserRecordLinkTableName } =
      nangoRepo.linkCrmRecordWriteRequest(crmUserRecordLink)
    pushWriteRequest(crmUserRecordLinkTableName, putItemInput)
  }

  // transactions
  logger.info('Creating transactions...')
  for (const txn of getTransactions()) {
    const publicTxn = internalToPublic(txn)
    const { putItemInput, tableName } = txnRepo.saveDemoTransaction(publicTxn, {
      status: getAggregatedRuleStatus(publicTxn.hitRules),
      executedRules: publicTxn.executedRules,
      hitRules: publicTxn.hitRules,
    })
    pushWriteRequest(tableName, putItemInput)
  }

  // risk scores
  logger.info('Updating average ARS score for users...')
  const transactionsForArs = getTransactions()
  for (const user of users) {
    let transactionCount = 0,
      arsScoreSummation = 0
    transactionsForArs.forEach((tx) => {
      if (
        tx.originUserId === user.userId ||
        tx.destinationUserId === user.userId
      ) {
        if (tx.arsScore) {
          transactionCount++
          arsScoreSummation += tx.arsScore.arsScore
        }
      }
    })
    let userAvgArsScore = 0
    if (transactionCount == 0) {
      userAvgArsScore = 0
    } else {
      userAvgArsScore = arsScoreSummation / transactionCount
    }
    const key = DynamoDbKeys.AVG_ARS_VALUE_ITEM(tenantId, user.userId, '1')
    const averageArsScore = {
      userId: user.userId,
      value: userAvgArsScore,
      transactionCount: transactionCount,
      createdAt: Date.now(),
    }
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
    const putItemInput = {
      PutRequest: {
        Item: {
          ...key,
          ...averageArsScore,
        },
      },
    }
    pushWriteRequest(tableName, putItemInput)
  }

  await dangerouslyDeletePartition(
    dynamoDb,
    tenantId,
    DynamoDbKeys.RISK_FACTOR(tenantId).PartitionKeyID,
    StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
  )
  for (const arsScore of getArsScores()) {
    const newArsScoreItem: ArsScore = {
      arsScore: handleSmallNumber(arsScore.arsScore),
      createdAt: Date.now(),
      originUserId: arsScore.originUserId,
      destinationUserId: arsScore.destinationUserId,
      transactionId: arsScore.transactionId,
      components: arsScore.components,
      factorScoreDetails: arsScore.factorScoreDetails,
    }
    const key = DynamoDbKeys.ARS_VALUE_ITEM(
      tenantId,
      arsScore.transactionId as string,
      '1'
    )
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
    const putItemInput = {
      PutRequest: {
        Item: {
          ...key,
          ...newArsScoreItem,
        },
      },
    }
    pushWriteRequest(tableName, putItemInput)
  }

  for (const krsScore of getKrsScores()) {
    const newKrsScoreItem: KrsScore = {
      krsScore: handleSmallNumber(krsScore.krsScore),
      createdAt: Date.now(),
      userId: krsScore.userId as string,
      components: krsScore.components ?? [],
      factorScoreDetails: krsScore.factorScoreDetails ?? [],
      isLocked: krsScore.isLocked ?? false,
    }
    const key = DynamoDbKeys.KRS_VALUE_ITEM(
      tenantId,
      krsScore.userId as string,
      '1'
    )
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
    const putItemInput = {
      PutRequest: {
        Item: {
          ...key,
          ...newKrsScoreItem,
        },
      },
    }
    pushWriteRequest(tableName, putItemInput)
  }

  for (const drsScore of getDrsScores()) {
    const prevDrsScore = await riskRepo.getDrsScore(drsScore.userId as string)
    const newDrsScoreItem: DrsScore = {
      drsScore: handleSmallNumber(drsScore.drsScore),
      transactionId: drsScore.transactionId as string,
      createdAt: Date.now(),
      isUpdatable: drsScore.isUpdatable ?? true,
      userId: drsScore.userId as string,
      components: drsScore.components ?? [],
      factorScoreDetails: drsScore.factorScoreDetails ?? [],
      triggeredBy: getTriggerSource(),
      prevDrsScore: prevDrsScore?.drsScore,
    }
    const key = DynamoDbKeys.DRS_VALUE_ITEM(
      tenantId,
      drsScore.userId as string,
      '1'
    )
    const tableName = StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME(tenantId)
    const putItemInput = {
      PutRequest: {
        Item: {
          ...key,
          ...newDrsScoreItem,
        },
      },
    }
    pushWriteRequest(tableName, putItemInput)
  }

  // cases and alerts
  logger.info('Create cases')
  // not required as we overwrite it using put request
  // await dynamoCaseRepository.deleteCasesData(tenantId)
  // await dynamoAlertRepository.deleteAlertsData(tenantId)
  // no need to add alerts here as it gets added in the add case method
  await dynamoCaseRepository.saveCases(getCases(), false)

  // custom risk factors
  const {
    writeRequests: customriskFactorWriteRequests,
    tableName: customRiskFactorTableName,
  } = await riskRepo.createDemoRiskFactor(riskFactors())
  customriskFactorWriteRequests.forEach((writeRequest) => {
    pushWriteRequest(customRiskFactorTableName, writeRequest)
  })

  // default risk factors
  let riskFactorCounter = riskFactors().length
  const defaultRiskFactors = RISK_FACTORS.map((riskFactor) => ({
    id: `RF-${String(++riskFactorCounter).padStart(3, '0')}`,
    ...riskFactor,
  }))
  const {
    writeRequests: defaultRiskFactorWriteRequests,
    tableName: defaultRiskFactorTableName,
  } = await riskRepo.createDemoRiskFactor(defaultRiskFactors)
  defaultRiskFactorWriteRequests.forEach((writeRequest) => {
    pushWriteRequest(defaultRiskFactorTableName, writeRequest)
  })

  // default reasons
  logger.info('Create default reasons')
  const reasonRepo = new DynamoReasonsRepository(tenantId, dynamoDb)
  const { writeRequests: reasonsWriteRequests, tableName: reasonsTableName } =
    await reasonRepo.saveDemoReasons(getDefaultReasonsData())
  reasonsWriteRequests.forEach((writeRequest) => {
    pushWriteRequest(reasonsTableName, writeRequest)
  })

  // audit logs
  logger.info('Create audit logs')
  const auditLogRepository = new DynamoAuditLogRepository(tenantId, dynamoDb)
  const { writeRequests: auditLogWriteRequests, tableName: auditLogTableName } =
    await auditLogRepository.saveDemoAuditLog(auditlogs())
  auditLogWriteRequests.forEach((writeRequest) => {
    pushWriteRequest(auditLogTableName, writeRequest)
  })

  // counters
  logger.info('DYNAMO: Create counters')
  const counterRepo = new DynamoCounterRepository(tenantId, dynamoDb)
  const { writeRequests: countersWriteRequests, tableName: countersTableName } =
    await counterRepo.saveDemoCounterValue(getCounterCollectionData(tenantId))
  countersWriteRequests.forEach((writeRequest) => {
    pushWriteRequest(countersTableName, writeRequest)
  })

  // alerts Qa sampling
  logger.info('DYNAMO: Create alerts Qa sampling')
  const {
    writeRequests: alertsQaSampleWriteRequests,
    tableName: alertsQaSampleTableName,
  } = await dynamoAlertRepository.saveDemoQASampleData(getQASamples())
  alertsQaSampleWriteRequests.forEach((writeRequest) => {
    pushWriteRequest(alertsQaSampleTableName, writeRequest)
  })

  // notifications
  logger.info('DYNAMO: Create notifications')
  const {
    writeRequests: notificationsWriteRequests,
    tableName: notificationsTableName,
  } = await dynamoNotificationRepository.saveDemoNotifications(
    getNotifications()
  )
  notificationsWriteRequests.forEach((writeRequest) => {
    pushWriteRequest(notificationsTableName, writeRequest)
  })

  // writing data to dynamo db
  for (const tableName in writeRequests) {
    logger.info(
      `TIME: DynamoDB: ${tableName} inserting ${writeRequests[tableName].length} records`
    )
    const now = Date.now()
    await batchWrite(dynamoDb, writeRequests[tableName], tableName)
    logger.info(
      `TIME: DynamoDB: ${tableName} inserting data took ~ ${Date.now() - now}`
    )
  }
}
