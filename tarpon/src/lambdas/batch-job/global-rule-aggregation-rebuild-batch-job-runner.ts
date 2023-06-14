import { BatchJobRunner } from './batch-job-runner-base'
import { AGGREGATORS } from '@/services/rules-engine/aggregator'
import { GlobalRuleAggregationRebuildBatchJob } from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'

export class GlobalRuleAggregationRebuildBatchJobRunner
  implements BatchJobRunner
{
  public async run(job: GlobalRuleAggregationRebuildBatchJob) {
    const { tenantId, parameters } = job
    const Aggregator = AGGREGATORS[parameters.aggregatorName]
    const dynamoDb = getDynamoDbClient()
    const aggregator = new Aggregator(tenantId, dynamoDb)
    await aggregator.rebuildAggregation(parameters.userId)
  }
}
