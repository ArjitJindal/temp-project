import _ from 'lodash'
import { TimeWindowGranularity } from './time-utils'
import { USER_TYPES } from '@/@types/user/user-type'
import { COUNTRY_CODES } from '@/utils/countries'
import {
  uiSchema,
  UiSchemaParams,
  UiSchemaParamsAgeRange,
} from '@/services/rules-engine/utils/rule-schema-utils'
import { TRANSACTION_STATES } from '@/@types/openapi-public-custom/TransactionState'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'
import { TRANSACTION_TYPES } from '@/@types/openapi-public-custom/TransactionType'
import { SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/SanctionsSearchType'

type SchemaOptions = {
  title?: string
  description?: string
  uiSchema?: UiSchemaParams<unknown>
}

export type TimeWindow = {
  units: number
  granularity: TimeWindowGranularity
  rollingBasis?: boolean
}

export type DayWindow = {
  units: number
  granularity: 'day'
  rollingBasis?: boolean
}

export const TIME_WINDOW_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, { subtype: 'TIME_WINDOW' }),
    type: 'object',
    title: options?.title || 'Time window',
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

export const TIME_WINDOW_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...TIME_WINDOW_SCHEMA(options),
    nullable: true,
    required: [],
  } as const)

export const DAY_WINDOW_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'object',
    ...uiSchema(options?.uiSchema, { subtype: 'DAY_WINDOW' }),
    title: options?.title || 'Time window (day)',
    description: options?.description,
    properties: {
      units: { type: 'integer', title: 'Number of days', minimum: 0 },
      granularity: {
        type: 'string',
        title: 'Time granularity',
        enum: ['day'],
      },
      rollingBasis: {
        type: 'boolean',
        title: 'Rolling basis',
        description:
          'When rolling basis is disabled, system starts the time period at 00:00.',
        nullable: true,
      },
    },
    required: ['units', 'granularity'],
  } as const)

export const AGE_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'object',
    ...uiSchema(options?.uiSchema, { subtype: 'AGE' }),
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

type AgeRangeSchemaOptions = SchemaOptions & {
  uiSchema?: Partial<UiSchemaParamsAgeRange>
}

export const AGE_RANGE_SCHEMA = (options?: AgeRangeSchemaOptions) =>
  ({
    type: 'object',
    ...uiSchema(options?.uiSchema, {
      subtype: 'AGE_RANGE',
      defaultGranularity: options?.uiSchema?.defaultGranularity,
    }),
    title: options?.title || 'User age range',
    description: options?.description,
    properties: {
      minAge: AGE_OPTIONAL_SCHEMA({ title: 'Min age' }),
      maxAge: AGE_OPTIONAL_SCHEMA({ title: 'Max age' }),
    },
    required: [],
  } as const)

export const AGE_RANGE_OPTIONAL_SCHEMA = (options?: AgeRangeSchemaOptions) =>
  ({
    ...AGE_RANGE_SCHEMA(options),
    nullable: true,
  } as const)

export const COUNTRIES_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'COUNTRIES',
    }),
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

export const CURRENCY_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'string',
    ...uiSchema(options?.uiSchema, { subtype: 'CURRENCY' }),
    title: options?.title || 'Currency',
    description: options?.description,
  } as const)

export const CURRENCIES_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'array',
    ...uiSchema(options?.uiSchema, { subtype: 'CURRENCIES' }),
    title: options?.title || 'Currencies',
    description: options?.description,
    items: CURRENCY_SCHEMA(),
  } as const)

export const TRANSACTION_STATES_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'array',
    ...uiSchema(options?.uiSchema, { subtype: 'TRANSACTION_STATES' }),
    title: options?.title || 'Target transaction state',
    description:
      options?.description ||
      'If not specified, all transactions regardless of the state will be used for running the rule',
    items: {
      type: 'string',
      enum: TRANSACTION_STATES,
    },
    uniqueItems: true,
  } as const)

export const TRANSACTION_STATES_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...TRANSACTION_STATES_SCHEMA(options),
    nullable: true,
  } as const)

export const TRANSACTIONS_THRESHOLD_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'integer',
    ...uiSchema(options?.uiSchema, { subtype: 'TRANSACTIONS_THRESHOLD' }),
    title: options?.title || 'Transactions count threshold',
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

export const TRANSACTION_TYPE_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'string',
    enum: TRANSACTION_TYPES,
    ...uiSchema(options?.uiSchema, { subtype: 'TRANSACTION_TYPE' }),
    title: options?.title || 'Target transaction type',
    description: options?.description,
  } as const)

export const TRANSACTION_TYPES_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'array',
    ...uiSchema(options?.uiSchema, { subtype: 'TRANSACTION_TYPES' }),
    title: options?.title || 'Target transaction types',
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
    ...uiSchema(options?.uiSchema, { subtype: 'PAYMENT_METHOD' }),
    title: options?.title || 'Payment method',
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
    ...uiSchema(options?.uiSchema, {
      subtype: 'USER_TYPE',
    }),
    title: options?.title || 'User type',
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
    ...uiSchema(options?.uiSchema, {
      subtype: 'PAYMENT_CHANNEL',
    }),
    title: options?.title || 'Payment channel',
    description: options?.description,
  } as const)

export const PAYMENT_CHANNEL_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...PAYMENT_CHANNEL_SCHEMA(options),
    nullable: true,
  } as const)

export const TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'TRANSACTION_AMOUNT_THRESHOLDS',
    }),
    type: 'object',
    title: options?.title || 'Transactions amount threshold',
    description: options?.description,
    additionalProperties: {
      type: 'number',
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

export const CHECK_SENDER_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'string',
    title: 'Sender transaction direction to check',
    ...uiSchema(options?.uiSchema, {
      subtype: 'CHECK_SENDER',
    }),
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

export const CHECK_RECEIVER_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'CHECK_RECEIVER',
    }),
    type: 'string',
    title: 'Receiver transaction direction to check',
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

export type TransactionAmountRange = {
  [currency: string]: {
    max?: number
    min?: number
  }
}

export const TRANSACTION_AMOUNT_RANGE_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'object',
    ...uiSchema(options?.uiSchema, {
      subtype: 'TRANSACTION_AMOUNT_RANGE',
    }),
    title: options?.title || 'Transaction amount range',
    description: options?.description,
    additionalProperties: {
      type: 'object',
      properties: {
        max: { type: 'number', nullable: true },
        min: { type: 'number', nullable: true },
      },
    },
    required: [],
  } as const)

export const TRANSACTION_AMOUNT_RANGE_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...TRANSACTION_AMOUNT_RANGE_SCHEMA(options),
    nullable: true,
  } as const)

export const INITIAL_TRANSACTIONS_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'integer',
    ...uiSchema(options?.uiSchema, {
      subtype: 'INITIAL_TRANSACTIONS',
    }),
    title: 'Initial transactions count threshold',
    description:
      "rule is executed after the user's past transactions is greater or equal to the threshold",
  } as const)

export const INITIAL_TRANSACTIONS_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...INITIAL_TRANSACTIONS_SCHEMA(options),
    nullable: true,
  } as const)

export const LEVENSHTEIN_DISTANCE_THRESHOLD_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    type: 'number',
    ...uiSchema(options?.uiSchema, {
      subtype: 'LEVENSHTEIN_DISTANCE_THRESHOLD',
    }),
    title: 'Maximum number of single-character edits (Levenshtein distance)',
    description:
      'rule is run if the number of single-character edits is greater than the threshold',
  } as const)

export const LEVENSHTEIN_DISTANCE_THRESHOLD_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...LEVENSHTEIN_DISTANCE_THRESHOLD_SCHEMA(options),
    nullable: true,
  } as const)

export type Comparator = 'GREATER_THAN_OR_EQUAL_TO' | 'LESS_THAN_OR_EQUAL_TO'
export const COMPARATORS: Comparator[] = [
  'GREATER_THAN_OR_EQUAL_TO',
  'LESS_THAN_OR_EQUAL_TO',
]

export const COMPARATOR_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'string',
    enum: COMPARATORS,
    ...uiSchema(options?.uiSchema, { subtype: 'COMPARATOR' }),
    title: options?.title || 'Comparator',
    description: options?.description,
  } as const)

export type ValueComparator = {
  value: number
  comparator: Comparator
}

export const VALUE_COMPARATOR_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'object',
    title: options?.title || 'Value threshold',
    description: options?.description,
    properties: {
      value: {
        type: 'number',
        title: 'Value',
      },
      comparator: COMPARATOR_SCHEMA(),
    },
    required: ['value', 'comparator'],
  } as const)

export const VALUE_COMPARATOR_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...VALUE_COMPARATOR_SCHEMA(options),
    nullable: true,
  } as const)

export const MATCH_PAYMENT_METHOD_DETAILS_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'boolean',
    title: options?.title || 'Match payment method details',
    description:
      options?.description ||
      'Sender/Receiver is identified based on by payment details, not user ID',
  } as const)

export const MATCH_PAYMENT_METHOD_DETAILS_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...MATCH_PAYMENT_METHOD_DETAILS_SCHEMA(options),
    nullable: true,
  } as const)

type PercentSchemaOptions = SchemaOptions & {
  maximum?: number | 'NO_MAXIMUM'
}

export const PERCENT_SCHEMA = (options: PercentSchemaOptions) => {
  const { maximum, title, description } = options
  return {
    type: 'number',
    title: title,
    description,
    minimum: 0,
    maximum: maximum === 'NO_MAXIMUM' ? undefined : maximum ?? 100,
  } as const
}

export const PERCENT_OPTIONAL_SCHEMA = (options: PercentSchemaOptions) =>
  ({
    ...PERCENT_SCHEMA(options),
    nullable: true,
  } as const)

export const FUZZINESS_SCHEMA = PERCENT_SCHEMA({
  title: 'Fuzziness',
  description:
    'Enter fuzziness % to set the flexibility of search. 0% will look for exact matches only & 100% will look for even the slightest match in spellings/ phonetics',
})

export const SANCTIONS_SCREENING_TYPES_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema),
    type: 'array',
    title: options?.title || 'Screening',
    description:
      options?.description ||
      'Select type of screening that you want to run (Please refer to your contract to understand the cost implications for each screening type before you confirm.)',
    items: {
      type: 'string',
      enum: SANCTIONS_SEARCH_TYPES,
      enumNames: SANCTIONS_SEARCH_TYPES.map((type) =>
        _.startCase(_.lowerCase(type))
      ),
    },
    uniqueItems: true,
  } as const)

export const SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA = (
  options: PercentSchemaOptions
) =>
  ({
    ...SANCTIONS_SCREENING_TYPES_SCHEMA(options),
    nullable: true,
  } as const)
