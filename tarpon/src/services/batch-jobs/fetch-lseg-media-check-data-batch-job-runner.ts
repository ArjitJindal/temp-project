import compact from 'lodash/compact'
import { AnyBulkWriteOperation, Collection } from 'mongodb'
import { LSEGAPIDataProvider } from '../sanctions/providers/lseg-api-provider'
import { BatchJobRunner } from './batch-job-runner-base'
import { FetchLsegMediaCheckResultsBatchJob } from '@/@types/batch-job'
import { getMongoDbClientDb } from '@/utils/mongodb-utils'
import { LSEG_API_MEDIA_CHECK_RESULT_COLLECTION } from '@/utils/mongo-table-names'
import { logger } from '@/core/logger'
import { MediaCheckArticleSummary } from '@/@types/openapi-internal/MediaCheckArticleSummary'
import { MediaCheckArticleContent } from '@/@types/openapi-internal/MediaCheckArticleContent'

interface LSEGMediaCheckResultDocument {
  lsegCaseId?: string
  lsegArticleId?: string
  articleSummary?: MediaCheckArticleSummary
  articleContent?: MediaCheckArticleContent
}

export class FetchLsegMediaCheckResultsBatchJobRunner extends BatchJobRunner {
  protected async run(job: FetchLsegMediaCheckResultsBatchJob): Promise<void> {
    const { caseId, dateRange } = job.parameters
    const lsegApiProvider = await LSEGAPIDataProvider.build(job.tenantId)
    const mongoDb = await getMongoDbClientDb()
    const collection = mongoDb.collection<LSEGMediaCheckResultDocument>(
      LSEG_API_MEDIA_CHECK_RESULT_COLLECTION(job.tenantId)
    )
    let nextPageReference = await this.saveArticles(
      collection,
      lsegApiProvider,
      caseId,
      undefined,
      dateRange
    )
    while (nextPageReference) {
      nextPageReference = await this.saveArticles(
        collection,
        lsegApiProvider,
        caseId,
        nextPageReference,
        dateRange
      )
    }
  }

  private async saveArticles(
    collection: Collection<LSEGMediaCheckResultDocument>,
    lsegApiProvider: LSEGAPIDataProvider,
    caseId: string,
    nextPageReference: string | undefined,
    dateRange: {
      startDate: string
      endDate: string
    }
  ): Promise<string | undefined> {
    const articles = await lsegApiProvider.getMediaCheckResultsForCase(
      caseId,
      dateRange,
      nextPageReference
    )
    if (!articles || !articles.results) {
      logger.info(`No articles found for caseId: ${caseId}`)
      return articles?.pagination?.pageReferences?.next
    }
    const articleIds = compact(
      articles.results.map((result) => result.articleSummary?.articleId)
    )
    const articleContents = await lsegApiProvider.getMediaCheckArticleContents(
      caseId,
      articleIds
    )
    const articlesToSave = articleContents?.results?.map((result) => ({
      lsegCaseId: caseId,
      lsegArticleId: result.articleSummary?.articleId,
      articleSummary: result.articleSummary,
      articleContent: result.articleContent,
    }))
    if (articlesToSave?.length) {
      const bulkOps: AnyBulkWriteOperation[] = articlesToSave.map(
        (article, i) => ({
          updateOne: {
            filter: {
              lsegCaseId: caseId,
              lsegArticleId: article.lsegArticleId,
            },
            update: {
              $set: {
                ...article,
                id: `Article-${i + 1}`,
              },
            },
            upsert: true,
          },
        })
      )
      if (bulkOps?.length) {
        await collection.bulkWrite(bulkOps)
      }
    }
    return articles?.pagination?.pageReferences?.next
  }
}
