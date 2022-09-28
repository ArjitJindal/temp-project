import { JSONSchemaType } from 'ajv'
import TransactionAverageExceededRule, {
  TransactionsAverageExceededParameters,
} from './transactions-average-exceeded'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { Business } from '@/@types/openapi-public/Business'
import { RuleAction } from '@/@types/openapi-public/RuleAction'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import {
  PAYMENT_METHODS,
  TIME_WINDOW_SCHEMA,
} from '@/services/rules-engine/utils/time-utils'
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'

export interface TransactionsAverageAmountExceededParameters
  extends TransactionsAverageExceededParameters {
  multiplierThresholds: {
    [currency: string]: number
  }
}

export default class TransactionAverageAmountExceededRule extends TransactionAverageExceededRule<TransactionsAverageAmountExceededParameters> {
  transactionRepository?: TransactionRepository

  public static getSchema(): JSONSchemaType<TransactionsAverageAmountExceededParameters> {
    return {
      type: 'object',
      properties: {
        period1: TIME_WINDOW_SCHEMA({
          title: 'Current period',
        }),
        period2: TIME_WINDOW_SCHEMA({
          title: 'Reference period, should be larger than period1',
        }),
        excludePeriod1: {
          type: 'boolean',
          title: 'Exclude transactions in period1 from period2',
          nullable: true,
        },
        multiplierThresholds: {
          type: 'object',
          title: 'Maximum multiplier',
          additionalProperties: {
            type: 'integer',
            minimum: 1,
          },
          required: [],
          nullable: false,
        },
        paymentMethod: {
          type: 'string',
          title: 'Method of payment',
          enum: PAYMENT_METHODS,
          nullable: true,
        },
        transactionState: {
          type: 'string',
          enum: [
            'CREATED',
            'PROCESSING',
            'SENT',
            'EXPIRED',
            'DECLINED',
            'SUSPENDED',
            'REFUNDED',
            'SUCCESSFUL',
          ],
          title: 'Target Transaction State',
          description:
            'If not specified, all transactions regardless of the state will be used for running the rule',
          nullable: true,
        },
        transactionTypes: {
          type: 'array',
          title: 'Target Transaction Types',
          items: {
            type: 'string',
            enum: TRANSACTION_TYPES,
          },
          uniqueItems: true,
          nullable: true,
        },
        checkSender: {
          type: 'string',
          title: 'Origin User Transaction Direction',
          enum: ['sending', 'all', 'none'], // check origin user, only for sending transactions or as a receiver too
          nullable: false,
        },
        checkReceiver: {
          type: 'string',
          title: 'Destination User Transaction Direction',
          enum: ['receiving', 'all', 'none'],
          nullable: false,
        },
        ageRange: {
          type: 'object',
          title: 'Target Age Range',
          properties: {
            minAge: { type: 'integer', title: 'Min Age', nullable: true },
            maxAge: { type: 'integer', title: 'Max Age', nullable: true },
          },
          required: [],
          nullable: true,
        },
        userType: {
          type: 'string',
          title: 'User type',
          enum: ['BUSINESS', 'CONSUMER'],
          nullable: true,
        },
        transactionsNumberThreshold: {
          type: 'object',
          title: 'Minimum average in period1 for rule to trigger',
          properties: {
            min: { type: 'integer', title: 'Min', nullable: true },
            max: { type: 'integer', title: 'Max', nullable: true },
          },
          required: [],
          nullable: true,
        },
        averageThreshold: {
          type: 'object',
          title: 'Minimum average in period1 for rule to trigger',
          properties: {
            min: { type: 'integer', title: 'Min', nullable: true },
            max: { type: 'integer', title: 'Max', nullable: true },
          },
          required: [],
          nullable: true,
        },
      },
      required: [
        'period1',
        'period2',
        'multiplierThresholds',
        'checkSender',
        'checkReceiver',
      ],
    }
  }

  constructor(
    tenantId: string,
    data: {
      transaction: Transaction
      senderUser?: User | Business
      receiverUser?: User | Business
    },
    params: {
      parameters: TransactionsAverageAmountExceededParameters
      action: RuleAction
    },
    dynamoDb: AWS.DynamoDB.DocumentClient
  ) {
    super(
      tenantId,
      data,
      params,
      dynamoDb,
      'AMOUNT',
      params.parameters.multiplierThresholds
    )
  }
}
