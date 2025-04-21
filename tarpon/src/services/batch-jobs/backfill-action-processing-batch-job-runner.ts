import pMap from 'p-map'
import { chunk, compact } from 'lodash'
import { AlertsRepository } from '../alerts/repository'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { isV2RuleInstance } from '../rules-engine/utils'
import {
  ActionProcessingRecord,
  sendActionProcessionTasks,
} from '../cases/utils'
import { BatchJobRunner } from './batch-job-runner-base'
import { traceable } from '@/core/xray'
import { BackFillActionProcessing } from '@/@types/batch-job'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Alert } from '@/@types/openapi-internal/Alert'

const CHUNK_SIZE = 20
const CONCURRENCY = 3
const PROCESS_BATCH_SIZE = 100
const MONGO_BATCH_SIZE = 200

@traceable
export class BackFillActionProcessingBatchJobRunner extends BatchJobRunner {
  protected async run(job: BackFillActionProcessing) {
    const { tenantId } = job
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    const ruleInstances = await ruleInstanceRepository.getActiveRuleInstances()
    const filteredInstances =
      ruleInstances.filter((val) => !isV2RuleInstance(val)) ?? []
    const alertsRepository = new AlertsRepository(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const casesCollection = mongoDb.db().collection(CASES_COLLECTION(tenantId))
    const pipeline = await alertsRepository.getAlertsPipeline({
      filterRuleInstanceId: filteredInstances.map((val) => val.id ?? ''),
      filterAlertStatus: ['CLOSED'],
    })
    const cursor = casesCollection.aggregate<Alert>(pipeline)
    await processCursorInBatch(
      cursor,
      async (alerts) => {
        await pMap(
          chunk(alerts, CHUNK_SIZE),
          async (chunkedAlerts) => {
            const tasks = chunkedAlerts.map(
              (alert): ActionProcessingRecord | undefined => {
                if (!alert.alertId) {
                  return undefined
                }
                return {
                  entityId: alert.alertId,
                  reason: {
                    reasons: alert.lastStatusChange?.reason ?? [],
                    comment: alert.lastStatusChange?.comment ?? '',
                    timestamp: alert.lastStatusChange?.timestamp,
                  },
                  action: 'CLOSED',
                  tenantId,
                }
              }
            )
            await sendActionProcessionTasks(compact(tasks))
          },
          { concurrency: CONCURRENCY }
        )
      },
      {
        processBatchSize: PROCESS_BATCH_SIZE,
        mongoBatchSize: MONGO_BATCH_SIZE,
      }
    )
  }
}
