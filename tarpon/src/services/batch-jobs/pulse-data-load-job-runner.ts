import { LogicEvaluator } from '../logic-evaluator/engine'
import { BatchJobRunner } from './batch-job-runner-base'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { PulseDataLoadBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { RiskScoringService } from '@/services/risk-scoring'
import { traceable } from '@/core/xray'

@traceable
export class PulseDataLoadJobRunner extends BatchJobRunner {
  protected async run(job: PulseDataLoadBatchJob): Promise<void> {
    const { tenantId, awsCredentials } = job
    const dynamoDb = getDynamoDbClient(awsCredentials)
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringService = new RiskScoringService(
      tenantId,
      {
        dynamoDb,
        mongoDb,
      },
      logicEvaluator
    )

    await riskScoringService.backfillUserRiskScores()
  }
}
