import { range } from 'lodash'
import { BatchJobRunner } from './batch-job-runner-base'
import { MultiJobOngoingScreeningUserRuleBatchJob } from '@/@types/batch-job'
import { traceable } from '@/core/xray'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { USERS_COLLECTION } from '@/utils/mongodb-definitions'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'

const NUMBER_OF_JOBS = 20

@traceable
export class MultiJobOngoingScreeningRunner extends BatchJobRunner {
  protected async run(
    job: MultiJobOngoingScreeningUserRuleBatchJob
  ): Promise<void> {
    const mongoDB = await getMongoDbClient()
    const users = mongoDB
      ?.db()
      .collection<InternalUser>(USERS_COLLECTION(job.tenantId as string))
    if (!users) {
      return
    }
    const totalDocs = await users.estimatedDocumentCount()
    const batchSize = Math.ceil(totalDocs / NUMBER_OF_JOBS)

    const froms = (
      await Promise.all(
        range(NUMBER_OF_JOBS).map(async (i): Promise<string | null> => {
          const user = (
            await users
              .find({})
              .sort({ userId: 1 })
              .skip(i * batchSize)
              .limit(1)
              .toArray()
          )[0]

          if (user) {
            return user.userId
          }
          return null
        })
      )
    ).filter((p): p is string => Boolean(p))

    for (let i = 0; i < froms.length - 1; i++) {
      const from = froms[i][0]
      const to = froms[i + 1][0]

      await sendBatchJobCommand({
        type: 'ONGOING_SCREENING_USER_RULE',
        tenantId: job.tenantId,
        from,
        to,
      })
    }
    return
  }
}
