import * as http from 'http'
import * as AWS from 'aws-sdk'
import synthetics from 'Synthetics' // eslint-disable-line
import logger from 'SyntheticsLogger' // eslint-disable-line
import { memoize } from 'lodash'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { Transaction } from '@/@types/openapi-public/Transaction'

const awsApiGateway = new AWS.APIGateway()

const getApiKey = memoize(async () => {
  const apiKey = await awsApiGateway
    .getApiKey({
      apiKey: (process.env.INTEGRATION_TEST_API_KEY_ID as string) || '',
      includeValue: true,
    })
    .promise()

  return apiKey.value as string
})

const executeHttpStep = async <T>(
  apiPath: string,
  body: T,
  callback: (response: http.IncomingMessage) => Promise<void>
) => {
  const requestOptions: http.RequestOptions & { body: string } = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': await getApiKey(),
    },
    host: process.env.AUTH0_AUDIENCE?.replace('https://', '')?.replace('/', ''),
    path: apiPath,
    protocol: 'https:',
    body: JSON.stringify(body),
  }

  await synthetics.executeHttpStep(
    `Make a POST request to ${apiPath}`,
    requestOptions,
    callback
  )
}

export const handler = async () => {
  const syntheticsConfiguration = synthetics.getConfiguration()

  syntheticsConfiguration.setConfig({
    includeRequestHeaders: true,
    includeResponseHeaders: true,
    includeRequestBody: true,
    includeResponseBody: true,
    restrictedHeaders: [],
  })

  const transactionPayload: Transaction = {
    timestamp: Date.now(),
    transactionId: `canary-${Date.now()}`,
    type: 'REFUND',
  }

  await executeHttpStep<Transaction>(
    '/transactions',
    transactionPayload,
    async (response: http.IncomingMessage) => {
      return new Promise((resolve, reject) => {
        logger.info(
          `Request returned ${response.statusCode} status code with ${response.statusMessage} status message`
        )
        if (!response.statusCode) {
          reject('No status code found')
        }

        logger.info(`Status code: ${response.statusCode}`)
        if (response.statusCode !== 200) {
          reject('Status code is not 200')
        }

        logger.info(`Status message: ${response.statusMessage}`)
        response.on('data', (data: Uint8Array) => {
          const parsedData = JSON.parse(
            Buffer.from(data).toString()
          ) as TransactionMonitoringResult
          logger.info(JSON.stringify(parsedData))
          if (parsedData.transactionId !== transactionPayload.transactionId) {
            reject('Transaction ID does not match')
          }

          if (parsedData.executedRules.length === 0) {
            reject('No rules executed')
          }
        })

        logger.info('Request completed')
        response.on('end', () => {
          resolve(
            logger.info(
              `Request completed: ${response.statusCode} ${response.statusMessage}`
            )
          )
        })

        response.on('error', (error) => {
          reject(error)
        })
      })
    }
  )
}
