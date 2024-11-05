import { RequestOptions, IncomingMessage } from 'http'
import * as AWS from 'aws-sdk'
import synthetics from 'Synthetics' // eslint-disable-line
import logger from 'SyntheticsLogger' // eslint-disable-line
import { isEqual, memoize, omit } from 'lodash'
import pMap from 'p-map'
import { TransactionMonitoringResult } from '@/@types/openapi-public/TransactionMonitoringResult'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { TransactionEventMonitoringResult } from '@/@types/openapi-public/TransactionEventMonitoringResult'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'
import { TransactionState } from '@/@types/openapi-public/TransactionState'
import { UserState } from '@/@types/openapi-public/UserState'
import { BusinessUserEvent } from '@/@types/openapi-internal/BusinessUserEvent'
import { BusinessUserMonitoringResult } from '@/@types/openapi-public/BusinessUserMonitoringResult'
import { User } from '@/@types/openapi-internal/User'
import { ConsumerUserMonitoringResult } from '@/@types/openapi-public/ConsumerUserMonitoringResult'
import { ConsumerUserEvent } from '@/@types/openapi-internal/ConsumerUserEvent'
import { Business } from '@/@types/openapi-public/Business'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'

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

const CONCURRENT_BATCH_SIZE = 5

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
    timestamp: Date.now() + 1000,
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

  await pMap(
    [
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
              '[numeric instance is lower than the required minimum (minimum: 315529200000, found: 1)]'
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
              `[instance failed to match exactly one schema (matched 0 out of ${PAYMENT_METHODS.length})]`
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
              !data.validationErrors.startsWith(
                '[instance value ("AB") not found in enum (possible values:'
              )
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
              '[instance value ("INVALID") not found in enum (possible values: ["CREATED","PROCESSING","SENT","EXPIRED","DECLINED","SUSPENDED","REFUNDED","SUCCESSFUL","REVERSED"])]'
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
              ...transactionEventPayload?.updatedTransactionAttributes
                ?.originPaymentDetails,
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
              `[instance failed to match exactly one schema (matched 0 out of ${PAYMENT_METHODS.length})]`
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
    ],
    async (step) => {
      try {
        return await step
      } catch (error) {
        console.error('Error :', error)
        throw error
      }
    },
    { concurrency: CONCURRENT_BATCH_SIZE }
  )

  await pMap(
    [
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
              data.transaction === undefined ||
              data.transaction.transactionState !==
                inputPayload.transactionState
            ) {
              reject('Transaction state does not match')
            }

            if (
              !isEqual(
                data.transaction?.originPaymentDetails,
                inputPayload.updatedTransactionAttributes?.originPaymentDetails
              )
            ) {
              reject('Transaction update attributes do not match')
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
      executeHttpStep<TransactionEvent, TransactionEventMonitoringResult>(
        'Update transaction state without update attributes',
        '/events/transaction',
        omit(transactionEventPayload, ['updatedTransactionAttributes']),
        {
          statusCode: 200,
          statusMessage: 'OK',
          dataCallback: (inputPayload, data, reject) => {
            const uuidRegex =
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i
            if (
              data.transaction === undefined ||
              data.transaction.transactionState !==
                inputPayload.transactionState
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
    ],
    async (step) => {
      try {
        return await step
      } catch (error) {
        console.error('Error :', error)
        throw error
      }
    },
    { concurrency: CONCURRENT_BATCH_SIZE }
  )
}

const getTestBusinessUserSuccess = async () => {
  const businessUserPayload: Business = {
    userId: `BUSINESS-canary-${Date.now()}`,
    createdTimestamp: Date.now(),
    legalEntity: {
      companyGeneralDetails: {
        legalName: 'Jameson Breweries',
        businessIndustry: ['Alcohol', 'Scotch'],
      },
      companyFinancialDetails: {
        expectedTransactionAmountPerMonth: {
          amountValue: 5160000,
          amountCurrency: 'GBP',
        },
        expectedTurnoverPerMonth: {
          amountValue: 30000090,
          amountCurrency: 'GBP',
        },
        tags: [
          {
            key: 'averageNumberOfPaymentsPerMonth',
            value: '90',
          },
        ],
      },
      companyRegistrationDetails: {
        registrationIdentifier: 'IN22313',
        registrationCountry: 'DK',
        dateOfRegistration: '2022-01-01',
        taxIdentifier: 'BDH3N221E',
        legalEntityType: 'Pvt Ltd',
      },
      contactDetails: {
        websites: ['jamieson.com'],
      },
    },
    allowedPaymentMethods: ['GENERIC_BANK_ACCOUNT', 'WALLET', 'CARD', 'ACH'],
  }

  const businessEventPayload: BusinessUserEvent = {
    timestamp: Date.now() + 1000,
    userId: businessUserPayload.userId,
    updatedBusinessUserAttributes: {
      riskLevel: 'HIGH',
      kycStatusDetails: {
        status: 'SUCCESSFUL',
      },
      userStateDetails: {
        state: 'ACTIVE',
      },
      legalEntity: {
        companyGeneralDetails: {
          legalName: 'Mr Wu Semiconductors',
        },
        contactDetails: {
          addresses: [
            {
              addressLines: ['Klara-Franke Str 20'],
              postcode: '10557',
              city: 'Berlin',
              state: 'Berlin',
              country: 'Germany',
              tags: [
                {
                  key: 'customKey',
                  value: 'customValue',
                },
              ],
            },
          ],
        },
      },
    },
  }

  await pMap(
    [
      executeHttpStep<Business, BusinessUserMonitoringResult>(
        'Create Business User',
        '/business/users',
        businessUserPayload,
        {
          statusCode: 200,
          statusMessage: 'OK',
          dataCallback: (inputPayload, data, reject) => {
            if (data.userId !== inputPayload.userId) {
              reject('Business User ID does not match')
            }

            if ((data as any)?.message != null) {
              reject('Message should not be present')
            }
          },
        }
      ),

      executeHttpStep<Partial<Business>, ValidationError>(
        'Create Business with missing userId',
        '/business/users',
        omit(businessUserPayload, ['userId']),
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["userId"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),

      executeHttpStep<Partial<Business>, ValidationError>(
        'Incorrect type of Legal name',
        '/business/users',
        {
          ...businessUserPayload,
          legalEntity: {
            companyGeneralDetails: {
              legalName: 123 as any,
            },
          },
        },
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[instance type (integer) does not match any allowed primitive type (allowed: ["string"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<Business>, ValidationError>(
        'Value not provided in tags',
        '/business/users',
        {
          ...businessUserPayload,
          legalEntity: {
            ...businessUserPayload.legalEntity,
            companyFinancialDetails: {
              expectedTransactionAmountPerMonth: {
                amountValue: 5160000,
                amountCurrency: 'GBP',
              },
              expectedTurnoverPerMonth: {
                amountValue: 30000090,
                amountCurrency: 'GBP',
              },
              tags: [
                {
                  key: 'averageNumberOfPaymentsPerMonth',
                } as any,
              ],
            },
          },
        },
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["value"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<Business>, ValidationError>(
        'Company general details not provided',
        '/business/users',
        {
          ...businessUserPayload,
          legalEntity: {
            companyFinancialDetails: {
              expectedTransactionAmountPerMonth: {
                amountValue: 5160000,
                amountCurrency: 'GBP',
              },
              expectedTurnoverPerMonth: {
                amountValue: 30000090,
                amountCurrency: 'GBP',
              },
              tags: [
                {
                  key: 'averageNumberOfPaymentsPerMonth',
                  value: '90',
                },
              ],
            },
            companyRegistrationDetails: {
              registrationIdentifier: 'IN22313',
              registrationCountry: 'DK',
              dateOfRegistration: '2022-01-01',
              taxIdentifier: 'BDH3N221E',
              legalEntityType: 'Pvt Ltd',
            },
            contactDetails: {
              websites: ['jamieson.com'],
            },
          },
          allowedPaymentMethods: [
            'GENERIC_BANK_ACCOUNT',
            'WALLET',
            'CARD',
            'ACH',
          ],
        } as any,

        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["companyGeneralDetails"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),

      executeHttpStep<Partial<Business>, ValidationError>(
        'Empty body',
        '/business/users',
        {},
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["createdTimestamp","legalEntity","userId"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),

      executeHttpStep<Partial<Business>, UnauthorizedError>(
        'No api key',
        '/business/users',
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

      executeHttpStep<Partial<Business>, UnauthorizedError>(
        'Incorrect domain',
        '/business/users',
        businessUserPayload,
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
    ],
    async (step) => {
      try {
        return await step
      } catch (error) {
        console.error('Error :', error)
        throw error
      }
    },
    { concurrency: CONCURRENT_BATCH_SIZE }
  )

  await pMap(
    [
      //Business Events
      executeHttpStep<BusinessUserEvent, Partial<Business>>(
        'Update business user state with attributes',
        '/events/business/user',
        businessEventPayload,

        {
          statusCode: 200,
          statusMessage: 'OK',
          dataCallback: (inputPayload, data, reject) => {
            if (isEqual(data, inputPayload)) {
              reject('Business User State does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<BusinessUserEvent>, ValidationError>(
        'Business user Id not provided',
        '/events/business/user',
        omit(businessEventPayload, ['userId']),
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["userId"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<BusinessUserEvent>, ValidationError>(
        'Invalid Business user state',
        '/events/business/user',
        {
          ...businessEventPayload,
          updatedBusinessUserAttributes: {
            ...businessEventPayload.updatedBusinessUserAttributes,
            userStateDetails: {
              state: 'INVALID' as UserState,
            },
          },
        },
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[instance value ("INVALID") not found in enum (possible values: ["UNACCEPTABLE","TERMINATED","ACTIVE","DORMANT","CREATED","SUSPENDED","BLOCKED"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<BusinessUserEvent>, ValidationError>(
        'Invalid country code',
        '/events/business/user',
        {
          ...businessEventPayload,
          updatedBusinessUserAttributes: {
            ...businessEventPayload.updatedBusinessUserAttributes,
            legalEntity: {
              companyGeneralDetails: {
                legalName: 'Mr Postman',
              },
              companyRegistrationDetails: {
                registrationCountry: 'AB' as any,
                registrationIdentifier: 'AB',
              },
            },
          },
        },

        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              !data.validationErrors.startsWith(
                '[instance value ("AB") not found in enum (possible values:'
              )
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<BusinessUserEvent>, ValidationError>(
        'Timestamp provided as string',
        '/events/business/user',
        {
          ...businessEventPayload,
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
          },
        }
      ),
      executeHttpStep<Partial<BusinessUserEvent>, NotFoundError>(
        'Invalid user id',
        '/events/business/user',
        {
          ...businessEventPayload,
          userId: `${businessEventPayload.userId}-1-invald`,
        },
        {
          statusCode: 404,
          statusMessage: 'Not Found',
          dataCallback: (inputPayload, data, reject) => {
            const userId = inputPayload.userId
            if (
              data.message !==
              `User ${userId} not found. Please create the user ${userId}`
            ) {
              reject('Message does not match')
            }
            if (data.error !== `NotFoundError`) {
              reject('Error message does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<BusinessUserEvent>, ValidationError>(
        'Invalid legal type name',
        '/events/business/user',
        {
          ...businessEventPayload,
          updatedBusinessUserAttributes: {
            ...businessEventPayload.updatedBusinessUserAttributes,
            legalEntity: {
              companyGeneralDetails: {
                legalName: true,
              },
            },
          } as any,
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
      executeHttpStep<Partial<BusinessUserEvent>, ValidationError>(
        'Empty body',
        '/events/business/user',
        {},
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["timestamp","userId"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),

      executeHttpStep<Partial<BusinessUserEvent>, GatewayError>(
        'Invalid API key',
        '/events/business/user',
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

      executeHttpStep<Partial<BusinessUserEvent>, UnauthorizedError>(
        'Incorrect domain',
        '/events/business/user',
        businessEventPayload,
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

      executeHttpStep<BusinessUserEvent, Partial<Business>>(
        'Update business state without update attributes',
        '/events/business/user',

        {
          timestamp: 1262300400009,
          userId: businessUserPayload.userId,
        },

        {
          statusCode: 200,
          statusMessage: 'OK',
          dataCallback: (inputPayload, data, reject) => {
            if (isEqual(data, inputPayload)) {
              reject('Business state does not match')
            }
          },
        }
      ),

      executeHttpStep<Partial<BusinessUserEvent>, UnauthorizedError>(
        'No api key',
        '/events/business/user',
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
    ],
    async (step) => {
      try {
        return await step
      } catch (error) {
        console.error('Error :', error)
        throw error
      }
    },
    { concurrency: CONCURRENT_BATCH_SIZE }
  )

  await pMap(
    [
      executeHttpStep<
        Business,
        BusinessUserMonitoringResult & { message: string }
      >('Duplicate User Id', '/business/users', businessUserPayload, {
        statusCode: 200,
        statusMessage: 'OK',
        dataCallback: (inputPayload, data, reject) => {
          if (data.userId !== inputPayload.userId) {
            reject('User ID does not match')
          }

          if (
            data.message !==
            'The provided userId already exists. The user attribute updates are not saved. If you want to update the attributes of this user, please use user events instead.'
          ) {
            reject('Message is incorrect or missing')
          }
        },
      }),

      executeHttpStep<Partial<Business>, NotFoundError>(
        'Linked entity does not exist',
        '/business/users',
        {
          ...businessUserPayload,
          userId: `${businessUserPayload.userId}-1`,
          linkedEntities: {
            parentUserId: `LINKED-${businessUserPayload.userId}-1`,
          },
        },
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            const message = `Parent user ID : LINKED-${businessUserPayload.userId}-1 passed in linkedEntities does not exist. Please create the entitiy before linking it`
            logger.info(
              `Expected message: ${message} \n Actual message: ${data.message}`
            )
            if (data.message !== message) {
              reject('Message does not match')
            }

            if (data.error !== 'BadRequestError') {
              reject('Check Error in Duplicate UserId')
            }
          },
        }
      ),
    ],
    async (step) => {
      try {
        return await step
      } catch (error) {
        console.error('Error :', error)
        throw error
      }
    },
    { concurrency: CONCURRENT_BATCH_SIZE }
  )
}

const getTestCustomerUserSuccess = async () => {
  const consumerUserPayload: User = {
    createdTimestamp: Date.now(),
    userId: `CONSUMER-canary-${Date.now()}`,
    reasonForAccountOpening: ['Payment', 'Deposits'],
    userDetails: {
      name: {
        firstName: 'Post Man',
        lastName: 'Dugar',
      },
      dateOfBirth: '2007-01-15',
      countryOfResidence: 'US',
      countryOfNationality: 'RU',
    },
    legalDocuments: [
      {
        documentType: 'passport',
        documentNumber: 'CB33GME6',
        documentIssuedDate: 1713192476788,
        documentExpirationDate: 1713192476788,
        documentIssuedCountry: 'US',
      },
    ],
    tags: [
      {
        key: 'hello',
        value: 'wallet',
      },
    ],
  }

  const consumerEventPayload: ConsumerUserEvent = {
    userId: consumerUserPayload.userId,
    timestamp: Date.now() + 1000,
    updatedConsumerUserAttributes: {
      riskLevel: 'HIGH',
      kycStatusDetails: {
        status: 'SUCCESSFUL',
      },
      userStateDetails: {
        state: 'ACTIVE',
      },
    },
  }

  await pMap(
    [
      executeHttpStep<User, ConsumerUserMonitoringResult>(
        'Create Consumer User',
        '/consumer/users',
        consumerUserPayload,
        {
          statusCode: 200,
          statusMessage: 'OK',
          dataCallback: (inputPayload, data, reject) => {
            if (data.userId !== inputPayload.userId) {
              reject('Consumer User ID does not match')
            }

            if ((data as any)?.message != null) {
              reject('Message should be null')
            }
          },
        }
      ),
      executeHttpStep<Partial<User>, ValidationError>(
        'Create Consumer with missing userId',
        '/consumer/users',
        omit(consumerUserPayload, ['userId']),
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["userId"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),

      executeHttpStep<Partial<User>, ValidationError>(
        'Incorrect type in first name',
        '/consumer/users',
        {
          ...consumerUserPayload,
          userDetails: {
            name: {
              firstName: true,
              lastName: 'Dugar',
            },
            dateOfBirth: '2007-01-15',
            countryOfResidence: 'US',
            countryOfNationality: 'RU',
          } as any,
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

      executeHttpStep<Partial<User>, ValidationError>(
        'First name not provided',
        '/consumer/users',
        {
          ...consumerUserPayload,
          userDetails: {
            name: {
              lastName: 'Test',
            },
            dateOfBirth: '2007-01-15',
            countryOfResidence: 'US',
            countryOfNationality: 'RU',
          } as any,
        },
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["firstName"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),

      executeHttpStep<Partial<User>, ValidationError>(
        'Value not provided in tags',
        '/consumer/users',
        {
          ...consumerUserPayload,
          tags: [
            {
              key: 'hello',
            } as any,
          ],
        },
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["value"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<User>, ValidationError>(
        'Empty body',
        '/consumer/users',
        {},
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["createdTimestamp","userId"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),

      executeHttpStep<Partial<User>, UnauthorizedError>(
        'No api key',
        '/consumer/users',
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
      executeHttpStep<Partial<User>, UnauthorizedError>(
        'Incorrect domain',
        '/consumer/users',
        consumerUserPayload,
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
    ],
    async (step) => {
      try {
        return await step
      } catch (error) {
        console.error('Error :', error)
        throw error
      }
    },
    { concurrency: CONCURRENT_BATCH_SIZE }
  )

  await pMap(
    [
      executeHttpStep<ConsumerUserEvent, Partial<User>>(
        'Update consumer user state with attributes',
        '/events/consumer/user',
        consumerEventPayload,
        {
          statusCode: 200,
          statusMessage: 'OK',
          dataCallback: (inputPayload, data, reject) => {
            if (isEqual(data, inputPayload)) {
              reject('Consumer State does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<ConsumerUserEvent>, ValidationError>(
        'Consumer user Id not provided',
        '/events/consumer/user',
        omit(consumerEventPayload, ['userId']),
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["userId"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<ConsumerUserEvent>, ValidationError>(
        'Invalid consumer user state',
        '/events/consumer/user',
        {
          ...consumerEventPayload,
          updatedConsumerUserAttributes: {
            ...consumerEventPayload.updatedConsumerUserAttributes,
            userStateDetails: {
              state: 'INVALID' as UserState,
            },
          },
        },
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[instance value ("INVALID") not found in enum (possible values: ["UNACCEPTABLE","TERMINATED","ACTIVE","DORMANT","CREATED","SUSPENDED","BLOCKED"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<ConsumerUserEvent>, ValidationError>(
        'Invalid country',
        '/events/consumer/user',
        {
          ...consumerEventPayload,
          updatedConsumerUserAttributes: {
            ...consumerEventPayload.updatedConsumerUserAttributes,
            legalDocuments: [
              {
                documentNumber: '123',
                documentType: 'Temo',
                documentIssuedCountry: 'AA' as any,
              },
            ],
          },
        },

        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              !data.validationErrors.startsWith(
                '[instance value ("AA") not found in enum (possible values:'
              )
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<ConsumerUserEvent>, ValidationError>(
        'Timestamp provided as string',
        '/events/consumer/user',
        {
          ...consumerEventPayload,
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
      executeHttpStep<Partial<ConsumerUserEvent>, NotFoundError>(
        'Invalid user id',
        '/events/consumer/user',
        {
          ...consumerEventPayload,
          userId: consumerUserPayload.userId + '-1-invalid',
        },

        {
          statusCode: 404,
          statusMessage: 'Not Found',
          dataCallback: (inputPayload, data, reject) => {
            const userId = inputPayload.userId
            if (
              data.message !==
              `User ${userId} not found. Please create the user ${userId}`
            ) {
              reject('Message does not match')
            }
            if (data.error !== `NotFoundError`) {
              reject('Error message does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<ConsumerUserEvent>, ValidationError>(
        'Empty body',
        '/events/consumer/user',
        {},
        {
          statusCode: 400,
          statusMessage: 'Bad Request',
          dataCallback: (_, data, reject) => {
            if (
              data.validationErrors !==
              '[object has missing required properties (["timestamp","userId"])]'
            ) {
              reject('Validation error does not match')
            }

            if (data.message !== 'Invalid request body') {
              reject('Message does not match')
            }
          },
        }
      ),

      executeHttpStep<ConsumerUserEvent, Partial<User>>(
        'Update consumer state without update attributes',
        '/events/consumer/user',
        { timestamp: 1262300400009, userId: consumerUserPayload.userId },
        {
          statusCode: 200,
          statusMessage: 'OK',
          dataCallback: (inputPayload, data, reject) => {
            if (isEqual(data, inputPayload)) {
              reject('Consumer state does not match')
            }
          },
        }
      ),
      executeHttpStep<Partial<ConsumerUserEvent>, UnauthorizedError>(
        'Incorrect domain',
        '/events/consumer/user',
        consumerEventPayload,
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
      executeHttpStep<Partial<ConsumerUserEvent>, UnauthorizedError>(
        'No api key',
        '/events/consumer/user',
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
    ],
    async (step) => {
      try {
        return await step
      } catch (error) {
        console.error('Error :', error)
        throw error
      }
    },
    { concurrency: CONCURRENT_BATCH_SIZE }
  )

  await pMap(
    [
      executeHttpStep<User, ConsumerUserMonitoringResult & { message: string }>(
        'Duplicate User Id',
        '/consumer/users',
        consumerUserPayload,
        {
          statusCode: 200,
          statusMessage: 'OK',
          dataCallback: (inputPayload, data, reject) => {
            if (data.userId !== inputPayload.userId) {
              reject('User ID does not match')
            }

            if (
              data.message !==
              'The provided userId already exists. The user attribute updates are not saved. If you want to update the attributes of this user, please use user events instead.'
            ) {
              reject('Message is incorrect or missing')
            }
          },
        }
      ),
    ],
    async (step) => {
      try {
        return await step
      } catch (error) {
        console.error('Error :', error)
        throw error
      }
    },
    { concurrency: CONCURRENT_BATCH_SIZE }
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

  await getTestTransactionSuccess()
  await getTestBusinessUserSuccess()
  await getTestCustomerUserSuccess()
}
