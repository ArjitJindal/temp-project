import { RequestOptions, IncomingMessage } from 'http'
import * as AWS from 'aws-sdk'
import synthetics from 'Synthetics' // eslint-disable-line
import logger from 'SyntheticsLogger' // eslint-disable-line
import { isEqual, memoize, omit } from 'lodash'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionEventMonitoringResult } from '@/@types/openapi-public/TransactionEventMonitoringResult'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { TransactionState } from '@/@types/openapi-public/TransactionState'

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

interface NotFoundError {
  error: string
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

  const transactionEventPayload: TransactionEvent = {
    transactionId: transactionPayload.transactionId,
    timestamp: Date.now(),
    transactionState: 'REFUNDED',
    updatedTransactionAttributes: {
      originPaymentDetails: {
        method: 'CARD',
        cardAuthenticated: true,
        cardIssuedCountry: 'AE',
        cardBrand: 'VISA',
        cardFunding: 'DEBIT',
        cardExpiry: {
          month: 12,
          year: 2023,
        },
        cardFingerprint: 'cRBAUn3Vqtzpf2uq',
        cardLast4Digits: '2018',
      },
    },
  }

  await Promise.all([
    // Transaction tests
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

          if (
            data.executedRules === undefined ||
            data.executedRules.length === 0
          ) {
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
    executeHttpStep<Transaction, ValidationError>(
      'Incorrect timestamp',
      '/transactions',
      {
        ...transactionPayload,
        timestamp: 1,
      },
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[numeric instance is lower than the required minimum (minimum: 1262300400000, found: 1)]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),
    executeHttpStep<Transaction, ValidationError>(
      'Invalid transaction method',
      '/transactions',
      {
        ...transactionPayload,
        originPaymentDetails: {
          method: 'INVALID' as any,
        },
      },
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[instance failed to match exactly one schema (matched 0 out of 9)]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),
    executeHttpStep<Transaction, ValidationError>(
      'Invalid country code',
      '/transactions',
      {
        ...transactionPayload,
        destinationAmountDetails: {
          transactionAmount: 100,
          country: 'AB' as any,
          transactionCurrency: 'EUR',
        },
      },
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[instance value ("AB") not found in enum (possible values: ["AF","AL","DZ","AS","AD","AO","AI","AQ","AG","AR","AM","AW","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BM","BT","BO","BQ","BA","BW","BV","BR","IO","BN","BG","BF","BI","CV","KH","CM","CA","KY","CF","TD","CL","CN","CX","CC","CO","KM","CD","CG","CK","CR","HR","CU","CW","CY","CZ","CI","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FK","FO","FJ","FI","FR","GF","PF","TF","GA","GM","GE","DE","GH","GI","GR","GL","GD","GP","GU","GT","GG","GN","GW","GY","HT","HM","VA","HN","HK","HU","IS","IN","ID","IR","IQ","IE","IM","IL","IT","JM","JP","JE","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI","LT","LU","MO","MG","MW","MY","MV","ML","MT","MH","MQ","MR","MU","YT","MX","FM","MD","MC","MN","ME","MS","MA","MZ","MM","NA","NR","NP","NL","NC","NZ","NI","NE","NG","NU","NF","MK","MP","NO","OM","PK","PW","PS","PA","PG","PY","PE","PH","PN","PL","PT","PR","QA","RO","RU","RW","RE","BL","SH","KN","LC","MF","PM","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SX","SK","SI","SB","SO","ZA","GS","SS","ES","LK","SD","SR","SJ","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TK","TO","TT","TN","TM","TC","TV","TR","UG","UA","AE","GB","UM","US","UY","UZ","VU","VE","VN","VG","VI","WF","EH","YE","ZM","ZW","AX","N/A"])]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),
    executeHttpStep<Transaction, ValidationError>(
      'Amount Provided as string instead of number',
      '/transactions',
      {
        ...transactionPayload,
        destinationAmountDetails: {
          transactionAmount: '100' as any,
          country: 'NL',
          transactionCurrency: 'EUR',
        },
      },
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[instance type (string) does not match any allowed primitive type (allowed: ["integer","number"])]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),
    executeHttpStep<Transaction, ValidationError>(
      'Transaction id is provided as boolean instead of string',
      '/transactions',
      {
        ...transactionPayload,
        transactionId: true as any,
      },
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[instance type (boolean) does not match any allowed primitive type (allowed: ["string"])]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),

    //Transaction Events
    executeHttpStep<TransactionEvent, TransactionEventMonitoringResult>(
      'Update transaction state with attributes',
      '/events/transaction',
      transactionEventPayload,
      {
        statusCode: 200,
        statusMessage: 'OK',
        dataCallback: (inputPayload, data, reject) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          if (
            data.transaction.transactionState !== inputPayload.transactionState
          ) {
            reject('Transaction state does not match')
          }

          if (
            !isEqual(
              data.transaction?.originPaymentDetails,
              inputPayload.updatedTransactionAttributes?.originPaymentDetails
            )
          ) {
            reject('Transaction update attributes does not match')
          }

          if (
            data.executedRules === undefined ||
            data.executedRules.length === 0
          ) {
            reject('No rules executed')
          }

          if (!uuidRegex.test(data.eventId)) {
            reject('Invalid transaction event id.')
          }
        },
      }
    ),
    executeHttpStep<Partial<TransactionEvent>, ValidationError>(
      'Transaction Id not provided',
      '/events/transaction',
      omit(transactionEventPayload, ['transactionId']),
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
    executeHttpStep<Partial<TransactionEvent>, ValidationError>(
      'Invalid transaction state',
      '/events/transaction',
      {
        ...transactionEventPayload,
        transactionState: 'INVALID' as TransactionState,
      },
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[instance value ("INVALID") not found in enum (possible values: ["CREATED","PROCESSING","SENT","EXPIRED","DECLINED","SUSPENDED","REFUNDED","SUCCESSFUL"])]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),
    executeHttpStep<Partial<TransactionEvent>, ValidationError>(
      'Invalid country',
      '/events/transaction',
      {
        ...transactionEventPayload,
        updatedTransactionAttributes: {
          ...transactionEventPayload.updatedTransactionAttributes,
          originPaymentDetails: {
            ...transactionEventPayload.updatedTransactionAttributes!
              .originPaymentDetails,
            cardIssuedCountry: 'AB' as any,
          } as any,
        },
      },
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[instance failed to match exactly one schema (matched 0 out of 9)]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),
    executeHttpStep<Partial<TransactionEvent>, ValidationError>(
      'Timestamp provided as string',
      '/events/transaction',
      {
        ...transactionEventPayload,
        timestamp: '1664985327329' as any,
      },
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[instance type (string) does not match any allowed primitive type (allowed: ["integer","number"])]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),
    executeHttpStep<Partial<TransactionEvent>, NotFoundError>(
      'Invalid transaction id',
      '/events/transaction',
      {
        ...transactionEventPayload,
        transactionId: 'T-invalid',
      },
      {
        statusCode: 404,
        statusMessage: 'Not Found',
        dataCallback: (inputPayload, data, reject) => {
          const transactionId = inputPayload.transactionId
          if (data.message !== `Transaction ${transactionId} not found`) {
            reject('Message does not match')
          }
          if (data.error !== `NotFoundError`) {
            reject('Error message does not match')
          }
        },
      }
    ),
    executeHttpStep<TransactionEvent, TransactionEventMonitoringResult>(
      'Update transaction state without update attributes',
      '/events/transaction',
      transactionEventPayload,
      {
        statusCode: 200,
        statusMessage: 'OK',
        dataCallback: (inputPayload, data, reject) => {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i
          if (
            data.transaction.transactionState !== inputPayload.transactionState
          ) {
            reject('Transaction state does not match')
          }

          if (
            data.executedRules === undefined ||
            data.executedRules.length === 0
          ) {
            reject('No rules executed')
          }

          if (!uuidRegex.test(data.eventId)) {
            reject('Invalid transaction event id.')
          }
        },
      }
    ),
    executeHttpStep<Partial<TransactionEvent>, ValidationError>(
      'Transaction state not provided',
      '/events/transaction',
      omit(transactionEventPayload, ['transactionState']),
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[object has missing required properties (["transactionState"])]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),
    executeHttpStep<Partial<TransactionEvent>, ValidationError>(
      'Empty body',
      '/events/transaction',
      {},
      {
        statusCode: 400,
        statusMessage: 'Bad Request',
        dataCallback: (_, data, reject) => {
          if (
            data.validationErrors !==
            '[object has missing required properties (["timestamp","transactionId","transactionState"])]'
          ) {
            reject('Validation error does not match')
          }

          if (data.message !== 'Invalid request body') {
            reject('Message does not match')
          }
        },
      }
    ),
    executeHttpStep<Partial<TransactionEvent>, UnauthorizedError>(
      'Incorrect domain',
      '/events/transaction',
      transactionEventPayload,
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
    executeHttpStep<Partial<TransactionEvent>, UnauthorizedError>(
      'No api key',
      '/events/transaction',
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

        if (
          data.executedRules === undefined ||
          data.executedRules.length === 0
        ) {
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
