import { BatchJobRunner } from './batch-job-runner-base'
import { DynamoCaseRepository } from '@/services/cases/dynamo-repository'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongo-table-names'
import { Case } from '@/@types/openapi-internal/Case'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { traceable } from '@/core/xray'
import { CasesBackfillDynamoBatchJob } from '@/@types/batch-job'

@traceable
export class CasesDynamoBackfillBatchJobRunner extends BatchJobRunner {
  protected async run(job: CasesBackfillDynamoBatchJob): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const db = mongoDb.db()
    const casesCollection = db.collection<Case>(CASES_COLLECTION(job.tenantId))
    const dynamoDb = getDynamoDbClient()
    const caseRepository = new DynamoCaseRepository(job.tenantId, dynamoDb)
    await processCursorInBatch(
      casesCollection.find({}),
      async (cases) => {
        await caseRepository.saveCases(cases, true)
      },
      { mongoBatchSize: 100, processBatchSize: 10, debug: true }
    )
  }
}
