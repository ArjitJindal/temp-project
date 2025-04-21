import { SQSEvent } from 'aws-lambda'
import { compact, groupBy, keyBy } from 'lodash'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { MongoClient } from 'mongodb'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import { ActionProcessingRecord } from '@/services/cases/utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { isV2RuleInstance } from '@/services/rules-engine/utils'
import { RuleThresholdOptimizer } from '@/services/rule-threshold'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { AlertsRepository } from '@/services/alerts/repository'

// ToDo: Use ReportBatchItemFailure

async function filterAndProcessActionTasks(
  records: ActionProcessingRecord[],
  tenantId: string,
  dbClients: {
    dynamoDb: DynamoDBDocumentClient
    mongoDb: MongoClient
  }
) {
  const { dynamoDb, mongoDb } = dbClients
  const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
    dynamoDb,
  })
  const ruleThresholdOptimizer = new RuleThresholdOptimizer(tenantId, {
    dynamoDb,
    mongoDb,
  })
  const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
  const instanceIdMap = keyBy(ruleInstances, 'id')
  const alertsRepository = new AlertsRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })
  const alerts = (
    await alertsRepository.getAlerts(
      {
        filterAlertIds: records.map((record) => record.entityId),
        pageSize: records.length,
      },
      {
        hideTransactionIds: false,
      }
    )
  ).data.map((d) => d.alert)
  const filteredModifiedRecords = compact(
    records
      .filter((record) => {
        const alert = alerts.find((alert) => alert.alertId === record.entityId)
        if (!alert) {
          return false
        }
        const instance = instanceIdMap[alert.ruleInstanceId]
        return isV2RuleInstance(instance) ? false : true // To only process V8 rule instances
      })
      .map((val) => {
        const alert = alerts.find((alert) => alert.alertId === val.entityId)
        if (!alert) {
          return undefined
        }
        return {
          alert,
          ruleInstance: instanceIdMap[alert.ruleInstanceId],
          reasonData: val.reason,
        }
      })
  )
  await Promise.all(
    filteredModifiedRecords.map((value) =>
      ruleThresholdOptimizer.processDisposition(value)
    )
  )
}

export const actionProcessingHandler = lambdaConsumer()(
  async (event: SQSEvent) => {
    const tasks = event.Records.map(
      (record): ActionProcessingRecord => JSON.parse(record.body)
    )
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const tenantTasksGrouped = groupBy(tasks, 'tenantId')
    await Promise.all(
      Object.entries(tenantTasksGrouped).map(([tenantId, tenantTasks]) =>
        filterAndProcessActionTasks(tenantTasks, tenantId, {
          dynamoDb,
          mongoDb,
        })
      )
    )
  }
)
