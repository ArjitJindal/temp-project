import { GetObjectCommand } from '@aws-sdk/client-s3'
import csvtojson from 'csvtojson'
import { Flagright, FlagrightClient } from 'flagright'
import { chunk } from 'lodash'
import { DynamoDbTransactionRepository } from '../rules-engine/repositories/dynamodb-transaction-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { getS3Client } from '@/utils/s3'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { PnbTransactionEventUpdatesBatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'
import { pickKnownEntityFields } from '@/utils/object'
import { Transaction } from '@/@types/openapi-public/Transaction'

export class PnbTransactionUpdatesBatchJobRunner extends BatchJobRunner {
  async run(job: PnbTransactionEventUpdatesBatchJob) {
    const dynamoDb = getDynamoDbClient()
    const transactionRepository = new DynamoDbTransactionRepository(
      job.tenantId,
      dynamoDb
    )
    const s3Client = getS3Client()
    const s3File = await s3Client.send(
      new GetObjectCommand({
        Bucket: process.env.IMPORT_BUCKET,
        Key: job.parameters.s3Key,
      })
    )

    const string = await s3File.Body?.transformToString()

    if (!string) {
      throw new Error('No string found in s3 object')
    }

    const transactions = await csvtojson().fromString(string)

    const flagrightClient = new FlagrightClient({
      apiKey: job.parameters.apiKey,
      environment: job.parameters.publicApiEndpoint,
    })

    const transactionsMapper = transactions.map((transaction) => {
      return {
        transactionId: transaction.SOURCEREFNO,
        amount: Number(transaction.AMOUNTAPPLIED),
      }
    })

    const chunks = chunk(transactionsMapper, job.parameters.concurrency)
    const transactionIdsNotFound: string[] = []
    let count = 0

    for (const chunk of chunks) {
      count++
      console.log(`Processing chunk ${count} of ${chunks.length}`)
      await Promise.all(
        chunk.map(async (transaction) => {
          const transactionData =
            await transactionRepository.getTransactionById(
              transaction.transactionId
            )

          if (!transactionData) {
            transactionIdsNotFound.push(transaction.transactionId)
            logger.error(
              `Transaction ${transaction.transactionId} not found in database`
            )
            logger.error(transactionIdsNotFound)
            return
          }

          try {
            const pickTransaction = pickKnownEntityFields(
              transactionData,
              Transaction
            ) as Flagright.Transaction
            await flagrightClient.transactions.verify({
              validateTransactionId: 'false',
              body: {
                ...pickTransaction,
                originUserId: pickTransaction.destinationUserId,
                destinationUserId: '',
              },
            })

            logger.warn(
              `Transaction ${transaction.transactionId} updated successfully`
            )
          } catch (error) {
            logger.error(
              `Error updating transaction ${transaction.transactionId}: ${error}`
            )
            transactionIdsNotFound.push(transaction.transactionId)
            logger.error(transactionIdsNotFound)
          }
        })
      )
    }
  }
}
