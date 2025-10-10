import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { LogicEvaluator } from '../logic-evaluator/engine'
import { BatchJobRunner } from './batch-job-runner-base'
import { traceable } from '@/core/xray'
import { BackFillAvgTrs } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'

@traceable
export class BackfillAvgTrsRunner extends BatchJobRunner {
  protected async run(job: BackFillAvgTrs) {
    const tenantId = job.tenantId
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        dynamoDb,
        mongoDb,
      }
    )
    await riskScoringV8Service.backFillAvgTrs()
  }
}
