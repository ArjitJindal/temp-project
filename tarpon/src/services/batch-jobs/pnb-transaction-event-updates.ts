import { GetObjectCommand } from '@aws-sdk/client-s3'
import csvtojson from 'csvtojson'
import { FlagrightClient } from 'flagright'
import { chunk } from 'lodash'
import { DynamoDbTransactionRepository } from '../rules-engine/repositories/dynamodb-transaction-repository'
import { BatchJobRunner } from './batch-job-runner-base'
import { getS3Client } from '@/utils/s3'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { PnbTransactionEventUpdatesBatchJob } from '@/@types/batch-job'
import { logger } from '@/core/logger'

export class PnbTransactionEventUpdatesBatchJobRunner extends BatchJobRunner {
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
              transaction.transactionId,
              [
                'transactionState',
                'originAmountDetails',
                'transactionId',
                'destinationAmountDetails',
              ]
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
            await flagrightClient.transactionEvents.create({
              transactionId: transaction.transactionId,
              timestamp: Date.now(),
              transactionState: transactionData.transactionState ?? 'CREATED',
              updatedTransactionAttributes: {
                ...(job.parameters.type === 'DEPOSIT' ||
                job.parameters.type === 'OTHERS' ||
                job.parameters.type === 'TRANSFER'
                  ? {
                      originAmountDetails: {
                        transactionCurrency:
                          transactionData.originAmountDetails
                            ?.transactionCurrency ?? 'MYR',
                        transactionAmount: transaction.amount,
                      },
                    }
                  : {}),
                ...(job.parameters.type === 'WITHDRAWAL' ||
                job.parameters.type === 'OTHERS' ||
                job.parameters.type === 'TRANSFER'
                  ? {
                      destinationAmountDetails: {
                        transactionAmount: transaction.amount,
                        transactionCurrency:
                          transactionData.destinationAmountDetails
                            ?.transactionCurrency ?? 'MYR',
                      },
                    }
                  : {}),
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
