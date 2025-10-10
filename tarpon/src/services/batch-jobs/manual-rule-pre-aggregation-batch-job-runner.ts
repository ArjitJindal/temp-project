import uniqBy from 'lodash/uniqBy'
import { getAggVarHash } from '../logic-evaluator/engine/aggregation-repository'
import { RuleInstanceRepository } from '../rules-engine/repositories/rule-instance-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { RulePreAggregationBatchJobRunner } from './rule-pre-aggregation-batch-job-runner'
import { traceable } from '@/core/xray'
import {
  BatchJobWithId,
  ManualRulePreAggregationBatchJob,
  RulePreAggregationBatchJob,
} from '@/@types/batch-job'
import { getDynamoDbClient } from '@/utils/dynamodb'

@traceable
export class ManualRulePreAggregationBatchJobRunner extends BatchJobRunner {
  protected async run(job: ManualRulePreAggregationBatchJob): Promise<void> {
    const runner = new RulePreAggregationBatchJobRunner(
      (job as BatchJobWithId).jobId
    )
    const ruleInstanceRepository = new RuleInstanceRepository(job.tenantId, {
      dynamoDb: getDynamoDbClient(),
    })
    const ruleInstances = await ruleInstanceRepository.getActiveRuleInstances()
    const logicAggregationVariables = uniqBy(
      ruleInstances.flatMap((v) => v.logicAggregationVariables ?? []),
      (v) => getAggVarHash(v, false)
    )

    for (const aggregationVariable of logicAggregationVariables) {
      const newJob: RulePreAggregationBatchJob & { jobId: string } = {
        jobId: (job as BatchJobWithId).jobId,
        type: 'RULE_PRE_AGGREGATION',
        tenantId: job.tenantId,
        parameters: {
          aggregationVariables: [aggregationVariable],
          currentTimestamp: job.currentTimestamp,
        },
      }

      console.info(
        `Pre-aggregating logic variable ${aggregationVariable.name} for rule ${aggregationVariable.key}`
      )

      await runner.execute(newJob)
    }
  }
}
