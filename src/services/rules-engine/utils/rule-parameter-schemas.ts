import { TimeWindowGranularity } from './time-utils'
import { TRANSACTION_TYPES } from '@/@types/tranasction/transaction-type'
import { PAYMENT_METHODS } from '@/@types/tranasction/payment-type'
import { USER_TYPES } from '@/@types/user/user-type'
import { COUNTRY_CODES } from '@/utils/countries'

type SchemaOptions = {
  title?: string
  description?: string
}

export type TimeWindow = {
  units: number
  granularity: TimeWindowGranularity
  rollingBasis?: boolean
}

export const TIME_WINDOW_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'object',
    title: options?.title || 'Time Window',
    description: options?.description,
    properties: {
      units: { type: 'integer', title: 'Number of time unit', minimum: 0 },
      granularity: {
        type: 'string',
        title: 'Time granularity',
        enum: ['second', 'minute', 'hour', 'day', 'week', 'month'],
      },
      rollingBasis: {
        type: 'boolean',
        title: 'Rolling basis',
        description:
          'When rolling basis is disabled, system starts the time period at 00:00 for day, week, month time granularities',
        nullable: true,
      },
    },
    required: ['units', 'granularity'],
  } as const)

export const AGE_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'object',
    title: options?.title || 'Age',
    description: options?.description,
    properties: {
      units: { type: 'integer', title: 'Number of time unit', minimum: 0 },
      granularity: {
        type: 'string',
        title: 'Time granularity',
        enum: ['day', 'month', 'year'],
        nullable: true,
      },
    },
    required: [],
  } as const)

export const AGE_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...AGE_SCHEMA(options),
    nullable: true,
  } as const)

export const COUNTRIES_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'array',
    title: options?.title || 'Countries (ISO 3166-1 alpha-2)',
    description: options?.description,
    items: { type: 'string', enum: COUNTRY_CODES },
    uniqueItems: true,
  } as const)

export const COUNTRIES_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...COUNTRIES_SCHEMA(options),
    nullable: true,
  } as const)

export const CURRENRIES_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'array',
    title: options?.title || 'Currencies',
    description: options?.description,
    items: { type: 'string' },
  } as const)

export const TRANSACTION_STATE_SCHEMA = (options?: SchemaOptions) =>
  ({
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
    title: options?.title || 'Target Transaction State',
    description:
      options?.description ||
      'If not specified, all transactions regardless of the state will be used for running the rule',
  } as const)

export const TRANSACTION_STATE_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...TRANSACTION_STATE_SCHEMA(options),
    nullable: true,
  } as const)

export const TRANSACTIONS_THRESHOLD_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'integer',
    title: options?.title || 'Transactions Count Threshold',
    description:
      options?.description ||
      'rule is run when the number of transactions per time window is greater than the threshold',
  } as const)

export const TRANSACTIONS_THRESHOLD_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...TRANSACTIONS_THRESHOLD_SCHEMA(options),
    nullable: true,
  } as const)

export const TRANSACTION_TYPES_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'array',
    title: options?.title || 'Target Transaction Types',
    description: options?.description,
    items: {
      type: 'string',
      enum: TRANSACTION_TYPES,
    },
    uniqueItems: true,
  } as const)

export const TRANSACTION_TYPES_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...TRANSACTION_TYPES_SCHEMA(options),
    nullable: true,
  } as const)

export const PAYMENT_METHOD_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'string',
    title: options?.title || 'Payment Method',
    description: options?.description,
    enum: PAYMENT_METHODS,
  } as const)

export const PAYMENT_METHOD_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...PAYMENT_METHOD_SCHEMA(options),
    nullable: true,
  } as const)

export const USER_TYPE_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'string',
    title: options?.title || 'User Type',
    description: options?.description,
    enum: USER_TYPES,
  } as const)

export const USER_TYPE_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...USER_TYPE_SCHEMA(options),
    nullable: true,
  } as const)

export const PAYMENT_CHANNEL_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'string',
    title: options?.title || 'Payment Channel',
    description: options?.description,
  } as const)

export const PAYMENT_CHANNEL_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...PAYMENT_CHANNEL_SCHEMA(options),
    nullable: true,
  } as const)

export const TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'object',
    title: options?.title || 'Transactions Amount Threshold',
    description: options?.description,
    additionalProperties: {
      type: 'integer',
    },
    required: [],
  } as const)

export const TRANSACTION_AMOUNT_THRESHOLDS_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA(options),
    nullable: true,
  } as const)

export const CHECK_SENDER_SCHEMA = () =>
  ({
    type: 'string',
    title: 'Sender Transaction Direction to Check',
    description:
      "sending: only check the sender's past sending transactions; all: check the sender's past sending and receiving transactions; none: do not check the sender",
    enum: ['sending', 'all', 'none'],
    // default: 'all',
  } as const)

export const CHECK_SENDER_OPTIONAL_SCHEMA = () =>
  ({
    ...CHECK_SENDER_SCHEMA(),
    nullable: true,
  } as const)

export const CHECK_RECEIVER_SCHEMA = () =>
  ({
    type: 'string',
    title: 'Receiver Transaction Direction to Check',
    description:
      "receiving: only check the receiver's past receiving transactions; all: check the receiver's past sending and receiving transactions; none: do not check the receiver",
    enum: ['receiving', 'all', 'none'],
    default: 'all',
  } as const)

export const CHECK_RECEIVER_OPTIONAL_SCHEMA = () =>
  ({
    ...CHECK_RECEIVER_SCHEMA(),
    nullable: true,
  } as const)

export const TRANSACTION_AMOUNT_RANGE_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'object',
    title: options?.title || 'Transaction Amount Range',
    description: options?.description,
    additionalProperties: {
      type: 'object',
      properties: {
        max: { type: 'integer' },
        min: { type: 'integer' },
      },
      required: ['max', 'min'],
    },
    required: [],
  } as const)

export const INITIAL_TRANSACTIONS_SCHEMA = () =>
  ({
    type: 'integer',
    title: 'Initial Transactions Count Threshold',
    description:
      "rule is executed after the user's past transactions is greater or equal to the threshold",
  } as const)

export const INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA = () =>
  ({
    ...INITIAL_TRANSACTIONS_SCHEMA(),
    nullable: true,
  } as const)

export const LEVENSHTEIN_DISTANCE_THRESHOLD_SCHEMA = () =>
  ({
    type: 'integer',
    title: 'Maximum number of single-character edits (Levenshtein distance)',
    description:
      'rule is run if the number of single-character edits is greater than the threshold',
  } as const)

export const LEVENSHTEIN_DISTANCE_THRESHOLD_OPTIONAL_SCHEMA = () =>
  ({
    ...LEVENSHTEIN_DISTANCE_THRESHOLD_SCHEMA(),
    nullable: true,
  } as const)
