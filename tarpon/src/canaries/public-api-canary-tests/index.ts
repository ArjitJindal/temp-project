import { RequestOptions, IncomingMessage } from 'http'
import * as AWS from 'aws-sdk'
import synthetics from 'Synthetics' // eslint-disable-line
import logger from 'SyntheticsLogger' // eslint-disable-line
import { memoize } from 'lodash'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { Transaction } from '@/@types/openapi-public/Transaction'

const awsApiGateway = new AWS.APIGateway()

interface ValidationError {
  message: string
  validationErrors: string
}

interface GatewayError {
  Message: string
}

interface UnauthorizedError {
  message: string
}

const getApiKey = memoize(async () => {
  const apiKey = await awsApiGateway
    .getApiKey({
      apiKey: (process.env.INTEGRATION_TEST_API_KEY_ID as string) || '',
      includeValue: true,
    })
    .promise()

  return apiKey.value as string
})

const executeHttpStep = async <T, R = unknown>(
  name: string,
  apiPath: string,
  body: T,
  expected: {
    statusCode: number
    statusMessage: string
    dataCallback: (
      inputPayload: T,
      data: R,
      reject: (reason?: any) => void
    ) => void
  },
  options?: {
    noApiKey?: boolean
    incorrectApiKey?: boolean
    incorrectDomain?: boolean
  }
) => {
  const fetchedApiKey = await getApiKey()

  const apiKey = options?.noApiKey
    ? ''
    : `${fetchedApiKey}${options?.incorrectApiKey ? 'a' : ''}`

  const host = !options?.incorrectDomain
    ? process.env.AUTH0_AUDIENCE?.replace('https://', '')?.replace('/', '')
    : process.env.ENV === 'dev'
    ? 'sandbox.api.flagright.com'
    : 'api.flagright.dev'

  const requestOptions: RequestOptions & { body: string } = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    host,
    path: apiPath,
    protocol: 'https:',
    body: JSON.stringify(body),
  }

  await synthetics.executeHttpStep(
    `Make a POST request to ${apiPath}: ${name}`,
    requestOptions,
    (response: IncomingMessage) => {
      return new Promise((resolve, reject) => {
        logger.info(
          `Request returned ${response.statusCode} status code with ${response.statusMessage} status message`
        )

        if (!response.statusCode) {
          reject('No status code found')
        }

        logger.info(`Status code: ${response.statusCode}`)
        if (response.statusCode !== expected.statusCode) {
          reject(`Status code does not match: ${response.statusCode}`)
        }

        if (!response.statusMessage) {
          reject('No status message found')
        }

        logger.info(`Status message: ${response.statusMessage}`)

        if (response.statusMessage !== expected.statusMessage) {
          reject(`Status message does not match: ${response.statusMessage}`)
        }

        response.on('data', (data: Uint8Array) => {
          const parsedData = JSON.parse(Buffer.from(data).toString()) as R
          logger.info(`Data: ${JSON.stringify(parsedData)}`)
          expected.dataCallback(body, parsedData, reject)
        })

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

const getTestTransactionSuccess = async () => {
  const transactionPayload: Transaction = {
    timestamp: Date.now(),
    transactionId: `canary-${Date.now()}`,
    type: 'REFUND',
    destinationAmountDetails: {
      transactionAmount: 100,
      transactionCurrency: 'EUR',
    },
    originAmountDetails: {
      transactionAmount: 100,
      transactionCurrency: 'EUR',
    },
  }

  await Promise.all([
    executeHttpStep<Transaction, TransactionMonitoringResult>(
      'Create transaction',
      '/transactions',
      transactionPayload,
      {
        statusCode: 200,
        statusMessage: 'OK',
        dataCallback: (inputPayload, data, reject) => {
          if (data.transactionId !== inputPayload.transactionId) {
            reject('Transaction ID does not match')
          }

          if (data.executedRules.length === 0) {
            reject('No rules executed')
          }
        },
      }
    ),
    executeHttpStep<Partial<Transaction>, ValidationError>(
      'Create transaction with missing transactionId',
      '/transactions',
      {
        timestamp: Date.now(),
        type: 'REFUND',
      },
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[object has missing required properties (["transactionId"])]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),
    executeHttpStep<Partial<Transaction>, ValidationError>(
      'No body',
      '/transactions',
      {},
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[object has missing required properties (["timestamp","transactionId","type"])]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),
    executeHttpStep<Partial<Transaction>, GatewayError>(
      'Incorrect api key',
      '/transactions',
      {},
      {
        statusCode: 403,
        statusMessage: 'Forbidden',
        dataCallback: (_, data, reject) => {
          if (
            data.Message !==
            'User is not authorized to access this resource with an explicit deny'
          ) {
            reject('Error message does not match')
          }
        },
      },
      { incorrectApiKey: true }
    ),
    executeHttpStep<Partial<Transaction>, UnauthorizedError>(
      'No api key',
      '/transactions',
      {},
      {
        statusCode: 401,
        statusMessage: 'Unauthorized',
        dataCallback: (_, data, reject) => {
          if (data.message !== 'Unauthorized') {
            reject('Error message does not match')
          }
        },
      },
      { noApiKey: true }
    ),
    executeHttpStep<Partial<Transaction>, UnauthorizedError>(
      'Incorrect domain',
      '/transactions',
      transactionPayload,
      {
        statusCode: 403,
        statusMessage: 'Forbidden',
        dataCallback: (_, data, reject) => {
          if (data.message !== 'Forbidden') {
            reject('Error message does not match')
          }
        },
      },
      { incorrectDomain: true }
    ),
  ])

  await Promise.all([
    executeHttpStep<
      Transaction,
      TransactionMonitoringResult & { message: string }
    >('Duplicate transaction', '/transactions', transactionPayload, {
      statusCode: 200,
      statusMessage: 'OK',
      dataCallback: (inputPayload, data, reject) => {
        if (data.transactionId !== inputPayload.transactionId) {
          reject('Transaction ID does not match')
        }

        if (
          data.message !==
          'The provided transactionId already exists. No rules were run. If you want to update the attributes of this transaction, please use transaction events instead.'
        ) {
          reject('Message is incorrect or missing')
        }

        if (data.executedRules.length === 0) {
          reject('No rules executed')
        }
      },
    }),
  ])
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

  await getTestTransactionSuccess()
}
