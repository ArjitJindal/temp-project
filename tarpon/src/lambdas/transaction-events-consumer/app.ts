import { SQSEvent, SQSRecord } from 'aws-lambda'
import { isEmpty, omit } from 'lodash'
import {
  SendMessageCommand,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import {
  initializeTenantContext,
  tenantHasFeature,
  tenantSettings,
  updateLogMetadata,
  withContext,
} from '@/core/utils/context'
import { TransactionWithRulesResult } from '@/@types/openapi-internal/TransactionWithRulesResult'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { CaseRepository } from '@/services/cases/repository'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { RiskScoringService } from '@/services/risk-scoring'
import { DYNAMO_KEYS } from '@/core/seed/dynamodb'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { CaseCreationService } from '@/services/cases/case-creation-service'
import { UserService } from '@/services/users'
import { filterLiveRules, runOnV8Engine } from '@/services/rules-engine/utils'
import { getSQSClient } from '@/utils/sns-sqs-client'
import { envIs } from '@/utils/env'
import { getRuleByRuleId } from '@/services/rules-engine/transaction-rules/library'
import { RuleJsonLogicEvaluator } from '@/services/rules-engine/v8-engine'
import { TransactionEventRepository } from '@/services/rules-engine/repositories/transaction-event-repository'

interface TransactionEventTask {
  tenantId: string
  transaction: TransactionWithRulesResult
}

export const transactionEventsHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    await Promise.all(
      event.Records.map((record: SQSRecord) => {
        return withContext(async () => {
          const task: TransactionEventTask = JSON.parse(record.body)
          await initializeTenantContext(task.tenantId)
          const { tenantId, transaction } = task
          await transactionHandler(tenantId, transaction)
        })
      })
    )
  }
)

export async function sendTransactionEvent({
  tenantId,
  transaction,
}: {
  tenantId: string
  transaction: TransactionWithRulesResult
}) {
  const tenantHasFeatureKinesisAsync = await tenantHasFeature(
    tenantId,
    'KINESIS_ASYNC'
  )
  if (envIs('local', 'test') || !tenantHasFeatureKinesisAsync) {
    await transactionHandler(tenantId, transaction)
  } else {
    const params: SendMessageCommandInput = {
      MessageBody: JSON.stringify({
        tenantId,
        transaction,
      }),
      QueueUrl: process.env.TRANSACTION_EVENT_QUEUE_URL ?? '',
      MessageGroupId: tenantId,
      MessageDeduplicationId: transaction.transactionId,
    }
    const sqsClient = getSQSClient()
    await sqsClient.send(new SendMessageCommand(params))
  }
}

export const transactionHandler = async (
  tenantId: string,
  transaction: TransactionWithRulesResult
) => {
  updateLogMetadata({ transactionId: transaction.transactionId })
  logger.info(`Processing Transaction`)

  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()

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

  const [transactionInMongo, ruleInstances, deployingRuleInstances] =
    await Promise.all([
      transactionsRepo.addTransactionToMongo(
        omit(transaction, DYNAMO_KEYS) as TransactionWithRulesResult,
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
