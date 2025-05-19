import { lowerCase, startCase } from 'lodash'
import { COUNTRY_CODES } from '@flagright/lib/constants'
import { humanizeAuto } from '@flagright/lib/utils/humanize'
import { TRANSACTION_TYPES } from '@flagright/lib/utils'
import { GenericScreeningValues } from '../user-rules/generic-sanctions-consumer-user'
import { SCREENING_FIELDS } from '../transaction-rules/payment-details-screening-base'
import { TimeWindowFiscalYear, TimeWindowGranularity } from './time-utils'
import { USER_TYPES } from '@/@types/user/user-type'
import {
  uiSchema,
  UiSchemaNumberSlider,
  UiSchemaParams,
  UiSchemaParamsAgeRange,
} from '@/services/rules-engine/utils/rule-schema-utils'
import { TRANSACTION_STATES } from '@/@types/openapi-public-custom/TransactionState'
import { PAYMENT_METHODS } from '@/@types/openapi-public-custom/PaymentMethod'
import { SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/SanctionsSearchType'
import { ACQUISITION_CHANNELS } from '@/@types/openapi-internal-custom/AcquisitionChannel'
import { CONSUMER_USER_SEGMENTS } from '@/@types/openapi-internal-custom/ConsumerUserSegment'
import { KYC_STATUSS } from '@/@types/openapi-public-custom/KYCStatus'
import { USER_STATES } from '@/@types/openapi-internal-custom/UserState'
import { BUSINESS_USER_SEGMENTS } from '@/@types/openapi-internal-custom/BusinessUserSegment'
import { PepRank } from '@/@types/openapi-internal/PepRank'
import { RULE_STAGES } from '@/@types/openapi-internal-custom/RuleStage'
import { GENERIC_SANCTIONS_SEARCH_TYPES } from '@/@types/openapi-internal-custom/GenericSanctionsSearchType'
import { FUZZINESS_SETTING_OPTIONSS } from '@/@types/openapi-internal-custom/FuzzinessSettingOptions'
import { PRODUCT_TYPES } from '@/@types/openapi-internal-custom/ProductType'

type SchemaOptions = {
  title?: string
  description?: string
  uiSchema?: UiSchemaParams<unknown>
}

export type TimeWindow = {
  units: number
  granularity: TimeWindowGranularity
  rollingBasis?: boolean
  fiscalYear?: TimeWindowFiscalYear
}

export type TransactionsCounterPartiesThreshold = {
  transactionsCounterPartiesCount: number
  checkPaymentMethodDetails?: boolean
}

export type DayWindow = {
  units: number
  granularity: 'day'
  rollingBasis?: boolean
}

export const TRANSACTION_COUNTERPARTIES_THRESHOLD_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    type: 'object',
    ...uiSchema(options?.uiSchema, { subtype: 'TRANSACTION_COUNTERPARTIES' }),
    title: options?.title || 'Unique transaction counterparties threshold',
    description:
      options?.description ||
      'Rule is run when number of unique transaction counterparties is greater or equal to threshold',
    properties: {
      transactionsCounterPartiesCount: {
        type: 'integer',
        title: 'Unique transaction counterparties count',
        description:
          'Number of unique transaction counterparties in the time window',
        minimum: 0,
      },
      checkPaymentMethodDetails: {
        type: 'boolean',
        title: 'Check payment method details',
        description:
          'If enabled, system will check only unique users with payment method details',
        nullable: true,
      },
    },
    required: ['transactionsCounterPartiesCount'],
  } as const)

export const TRANSACTION_COUNTERPARTIES_THRESHOLD_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...TRANSACTION_COUNTERPARTIES_THRESHOLD_SCHEMA(options),
    nullable: true,
  } as const)

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
        enum: [
          'second',
          'minute',
          'hour',
          'day',
          'week',
          'month',
          'year',
          'fiscal_year',
        ],
        enumNames: [
          'Second',
          'Minute',
          'Hour',
          'Day',
          'Week',
          'Month',
          'Year',
          'Fiscal year',
        ],
      },
      fiscalYear: {
        type: 'object',
        title: 'Fiscal year',
        description: 'Fiscal year',
        properties: {
          startMonth: {
            type: 'integer',
            title: 'Start month',
            description: 'Start month',
            minimum: 1,
            maximum: 12,
          },
          startDay: {
            type: 'integer',
            title: 'Start day',
            description: 'Start day',
            minimum: 1,
            maximum: 31,
          },
        },
        required: ['startMonth', 'startDay'],
        nullable: true,
      },
      rollingBasis: {
        type: 'boolean',
        title: 'Rolling basis',
        description:
          'With rolling basis, the time window looks back from the hit time by ‘N’ units. Without it, the window starts at the beginning of the selected unit and runs up to the hit time',
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
          'With rolling basis, the time window looks back from the hit time by ‘N’ units. Without it, the window starts at the beginning of the selected unit and runs up to the hit time',
        nullable: true,
      },
    },
    required: ['units', 'granularity'],
  } as const)

export const TRANSACTIONS_NUMBER_THRESHOLD_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'object',
    title: options?.title || 'Transaction number threshold',
    description:
      options?.description ||
      "Rule doesn't trigger if transactions number in period1 in less than 'Min' or more than 'Max'",
    properties: {
      min: {
        type: 'integer',
        title: 'Min',
        nullable: true,
      },
      max: {
        type: 'integer',
        title: 'Max',
        nullable: true,
      },
    },
  } as const)

export const TRANSACTIONS_NUMBER_THRESHOLD_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...TRANSACTIONS_NUMBER_THRESHOLD_SCHEMA(options),
    nullable: true,
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

type NumberSliderSchemaOptions = SchemaOptions & {
  uiSchema?: Partial<UiSchemaNumberSlider>
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

export const RULE_STAGE_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'RULE_STAGES',
    }),
    type: 'array',
    title: options?.title || 'User rule stage',
    description: options?.description,
    items: {
      type: 'string',
      enum: RULE_STAGES,
      enumNames: RULE_STAGES.map((stage) => startCase(stage.toLowerCase())),
    },
    labelProps: {
      hint: 'Initial - Screening is triggered once, when the user is first created on the platform.\nUpdate - Screening runs every time a User Event is received, and user details are updated.\nOngoing - Screening runs every 24 hours for all existing consumer users, starting from the moment it is enabled.',
    },
    uniqueItems: true,
    nullable: false,
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
    title: options?.title || 'Target transaction states',
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
    ...uiSchema(options?.uiSchema, {
      subtype: 'TRANSACTION_TYPE',
      uniqueType: 'TRANSACTION_TYPES',
    }),
    title: options?.title || 'Target transaction type',
    description: options?.description,
  } as const)

export const TRANSACTION_TYPES_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'array',
    ...uiSchema(options?.uiSchema, {
      subtype: 'TRANSACTION_TYPES',
      uniqueType: 'TRANSACTION_TYPES',
    }),
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

export const PAYMENT_METHODS_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'array',
    ...uiSchema(options?.uiSchema, { subtype: 'PAYMENT_METHOD' }),
    title: options?.title || 'Payment methods',
    description:
      options?.description ||
      'Select one or more payment methods to target transactions with those payment methods',
    items: {
      type: 'string',
      enum: PAYMENT_METHODS,
    },
    uniqueItems: true,
  } as const)

export const PAYMENT_METHODS_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...PAYMENT_METHODS_SCHEMA(options),
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

export const CARD_PAYMENT_CHANNELS_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'array',
    ...uiSchema(options?.uiSchema, {
      subtype: 'PAYMENT_CHANNELS',
    }),
    title: options?.title || 'Payment channels',
    description: options?.description,
    items: {
      type: 'string',
      enum: [],
    },
    uniqueItems: true,
  } as const)
export const BANKS_THRESHOLD_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'integer',
    ...uiSchema(options?.uiSchema, { subtype: 'BANKS_THRESHOLD' }),
    title: options?.title || 'Banks count threshold',
    description:
      options?.description ||
      'Rule is run when the number of different banks used for transactions per time window is greater than the threshold',
  } as const)

export const CARD_PAYMENT_CHANNELS_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...CARD_PAYMENT_CHANNELS_SCHEMA(options),
    nullable: true,
  } as const)

export const PRODUCT_TYPES_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'FREE_TEXT_ENUM',
    }),
    title: options?.title || 'Product type',
    description: options?.description,
    type: 'array',
    items: {
      type: 'string',
      enum: PRODUCT_TYPES,
    },
  } as const)

export const PRODUCT_TYPES_SCHEMA_OPTIONAL = (options?: SchemaOptions) =>
  ({
    ...PRODUCT_TYPES_SCHEMA(options),
    nullable: true,
  } as const)

export const TRANSACTION_AMOUNT_THRESHOLDS_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'TRANSACTION_AMOUNT_THRESHOLDS',
    }),
    type: 'object',
    title: options?.title || 'Transactions amount threshold',
    description:
      options?.description ||
      'Rule is run when the transaction amount is greater or equal to threshold',
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

export const ACQUISITION_CHANNEL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'ACQUISITION_CHANNEL',
    }),
    type: 'array',
    title: options?.title || 'Acquisition channel',
    description: options?.description,
    items: {
      type: 'string',
      enum: ACQUISITION_CHANNELS,
      enumNames: ACQUISITION_CHANNELS.map((channel) =>
        startCase(channel.replace('_', ' ').toLowerCase())
      ),
    },
    uniqueItems: true,
  } as const)

export const ACQUISITION_CHANNEL_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...ACQUISITION_CHANNEL_SCHEMA(options),
    nullable: true,
  } as const)

export const CONSUMER_USER_SEGMENT_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'CONSUMER_USER_SEGMENT',
    }),
    type: 'array',
    title: options?.title || 'User consumer segment',
    description:
      options?.description ||
      'Select one or more user consumer segments to target transactions with those consumer user segments',
    items: {
      type: 'string',
      enum: CONSUMER_USER_SEGMENTS,
      enumNames: CONSUMER_USER_SEGMENTS.map((segment) =>
        startCase(segment.replace('_', ' ').toLowerCase())
      ),
    },
    uniqueItems: true,
  } as const)

export const CONSUMER_USER_SEGMENT_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...CONSUMER_USER_SEGMENT_SCHEMA(options),
    nullable: true,
  } as const)

export const BUSINESS_USER_SEGMENT_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'CONSUMER_USER_SEGMENT',
    }),
    type: 'array',
    title: options?.title || 'User consumer segment',
    description:
      options?.description ||
      'Select one or more user business segments to target transactions with those business user segments',
    items: {
      type: 'string',
      enum: BUSINESS_USER_SEGMENTS,
      enumNames: BUSINESS_USER_SEGMENTS.map((segment) =>
        startCase(segment.replace('_', ' ').toLowerCase())
      ),
    },
    uniqueItems: true,
  } as const)

export const BUSINESS_USER_SEGMENT_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...BUSINESS_USER_SEGMENT_SCHEMA(options),
    nullable: true,
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

export interface TimeRangeHourAndMinute {
  utcHours: number
  utcMinutes: number
}
export interface TransactionTimeRange {
  startTime: TimeRangeHourAndMinute
  endTime: TimeRangeHourAndMinute
}

export const TRANSACTION_TIME_RANGE_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'object',
    ...uiSchema(options?.uiSchema, {
      subtype: 'TIME_RANGE',
    }),
    title: options?.title || 'Transaction time range',
    description: options?.description,
    properties: {
      startTime: {
        type: 'object',
        properties: {
          utcHours: {
            type: 'integer',
          },
          utcMinutes: {
            type: 'integer',
          },
        },
        required: ['utcHours', 'utcMinutes'],
        nullable: true,
      },
      endTime: {
        type: 'object',
        properties: {
          utcHours: {
            type: 'integer',
          },
          utcMinutes: {
            type: 'integer',
          },
        },
        required: ['utcHours', 'utcMinutes'],
        nullable: true,
      },
    },
    required: [],
  } as const)

export const TRANSACTION_TIME_RANGE_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...TRANSACTION_TIME_RANGE_SCHEMA(options),
    nullable: true,
  } as const)

export const KEY_VALUE_PAIR_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'object',
    ...uiSchema(options?.uiSchema, {
      subtype: 'TRANSACTION_KEY_VALUE',
    }),
    title: options?.title || 'Transaction key value',
    description: options?.description,
    additionalProperties: {
      type: 'array',
      items: {
        type: 'string',
      },
    },
    required: [],
  } as const)

export const KEY_VALUE_PAIR_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...KEY_VALUE_PAIR_SCHEMA(options),
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

export const LEVENSHTEIN_DISTANCE_THRESHOLD_PERCENTAGE_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    type: 'integer',
    ...uiSchema(options?.uiSchema, {
      subtype: 'LEVENSHTEIN_DISTANCE_THRESHOLD_PERCENTAGE',
    }),
    minimum: 0,
    maximum: 100,
    title: 'Fuzziness percentage (Levenshtein distance)',
    description:
      'Fuzziness adjusts how closely strings must match. Lower values mean stricter matching—for example, 20% allows up to 20% character differences.',
  } as const)

export const LEVENSHTEIN_DISTANCE_THRESHOLD_PERCENTAGE_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...LEVENSHTEIN_DISTANCE_THRESHOLD_PERCENTAGE_SCHEMA(options),
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
  minimum?: number
  multipleOf?: number
}

export const PERCENT_SCHEMA = (options: PercentSchemaOptions) => {
  const { maximum, title, description, minimum, multipleOf } = options
  return {
    type: 'number',
    title: title,
    description,
    minimum: minimum ?? 0,
    multipleOf,
    maximum: maximum === 'NO_MAXIMUM' ? undefined : maximum ?? 100,
    ...uiSchema(options?.uiSchema),
  } as const
}

export const PERCENT_OPTIONAL_SCHEMA = (options: PercentSchemaOptions) =>
  ({
    ...PERCENT_SCHEMA(options),
    nullable: true,
  } as const)

export const FUZZINESS_SCHEMA = (options: PercentSchemaOptions = {}) =>
  PERCENT_SCHEMA({
    title: 'Fuzziness',
    description:
      'Enter fuzziness % to set the flexibility of search. 0% will look for exact matches only & 100% will look for even the slightest match in spellings/phonetics',
    multipleOf: 10,
    ...options,
  })
export const SCREENING_PROFILE_ID_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'string',
    nullable: true,
    ...uiSchema(
      options?.uiSchema,
      {
        subtype: 'SCREENING_PROFILE_ID',
      },
      {
        requiredFeatures: ['ACURIS'],
      }
    ),
    title: 'Screening profile',
    description: 'Select the screening profile to be used for the screening',
  } as const)
export const IS_ACTIVE_SCHEMA = {
  type: 'boolean',
  nullable: true,
  title: 'Only apply to active screening entities',
  description: `Entities that are still actively on a watchlist are considered 'Active entities'`,
  ...uiSchema(
    {},
    {
      requiredFeatures: ['DOW_JONES', 'ACURIS'],
    }
  ),
} as const

export const PARTIAL_MATCH_SCHEMA = {
  type: 'boolean',
  nullable: true,
  title: 'Partial match',
  description: `If true, partial fuzzy matching will be applied`,
  ...uiSchema(
    {},
    {
      requiredFeatures: ['DOW_JONES', 'ACURIS', 'OPEN_SANCTIONS'],
    }
  ),
} as const

export const FUZZINESS_RANGE_SCHEMA = (options?: NumberSliderSchemaOptions) =>
  ({
    type: 'object',
    title: options?.title || 'Fuzziness range',
    ...uiSchema(
      {
        subtype: 'NUMBER_SLIDER_RANGE',
        minimum: 0,
        maximum: 100,
        multipleOf: 1,
        startExclusive: false,
        endExclusive: false,
      },
      options?.uiSchema
    ),
    description: options?.description,
    properties: {
      lowerBound: {
        type: 'number',
        title: 'Minimum',
      },
      upperBound: {
        type: 'number',
        title: 'Maximum',
      },
    },
    required: [],
  } as const)

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
        startCase(lowerCase(type))
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
export const GENERIC_SANCTIONS_SCREENING_TYPES_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'GENERIC_SANCTIONS_SCREENING_TYPES',
    }),
    type: 'array',
    title: options?.title || 'Screening types',
    description: options?.description,
    items: {
      type: 'string',
      enum: GENERIC_SANCTIONS_SEARCH_TYPES,
      enumNames: GENERIC_SANCTIONS_SEARCH_TYPES.map((type) =>
        humanizeAuto(type)
      ),
    },
    uniqueItems: true,
  } as const)
export const GENERIC_SANCTIONS_SCREENING_TYPES_OPTIONAL_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...GENERIC_SANCTIONS_SCREENING_TYPES_SCHEMA(options),
    nullable: true,
  } as const)
export const PAYMENT_DETAILS_SCREENING_FIELDS_SCHEMA = (
  options?: SchemaOptions
) =>
  ({
    ...uiSchema(options?.uiSchema),
    type: 'array',
    title: options?.title || 'Payment details screening fields',
    description: options?.description,
    items: {
      type: 'string',
      enum: SCREENING_FIELDS,
      enumNames: SCREENING_FIELDS.map((type) => humanizeAuto(type)),
    },
    uniqueItems: true,
  } as const)
const SANCTIONS_SCREENING_VALUES = ['NRIC', 'NATIONALITY', 'YOB', 'GENDER']
const PEP_RANK_VALUES: PepRank[] = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3']
export const SANCTIONS_SCREENING_VALUES_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      requiredFeatures: ['DOW_JONES'],
    }),
    type: 'array',
    title: options?.title || 'Screening values',
    description: options?.description,
    items: {
      type: 'string',
      enum: SANCTIONS_SCREENING_VALUES,
      enumNames: SANCTIONS_SCREENING_VALUES.map((type) => humanizeAuto(type)),
    },
    uniqueItems: true,
    nullable: true,
  } as const)
const GENERIC_SCREENING_VALUES: GenericScreeningValues[] = [
  'NATIONALITY',
  'YOB',
  'GENDER',
]
export const GENERIC_SCREENING_VALUES_SCHEMA = (
  options?: SchemaOptions,
  fieldsToPick?: GenericScreeningValues[]
) => {
  const values = fieldsToPick ?? GENERIC_SCREENING_VALUES
  return {
    ...uiSchema(options?.uiSchema, {
      requiredFeatures: ['OPEN_SANCTIONS', 'ACURIS', 'DOW_JONES'],
    }),
    type: 'array',
    title: options?.title || 'Screening values',
    description: options?.description,
    items: {
      type: 'string',
      enum: values,
      enumNames: values.map((type) => humanizeAuto(type)),
    },
    uniqueItems: true,
    nullable: true,
  } as const
}

export const STOPWORDS_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'array',
    ...uiSchema(options?.uiSchema, {
      requiredFeatures: ['ACURIS', 'OPEN_SANCTIONS', 'DOW_JONES'],
    }),
    items: {
      type: 'string',
    },
    title: options?.title || 'Stopwords configuration',
    description:
      options?.description ||
      `Specify stopwords to be ignored in fuzziness calculations, ensuring accurate matching by excluding specified terms from names.`,
  } as const)

export const STOPWORDS_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...STOPWORDS_SCHEMA(options),
    nullable: true,
  } as const)

export const FUZZINESS_SETTINGS_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'string',
    ...uiSchema(options?.uiSchema, {
      requiredFeatures: ['ACURIS', 'OPEN_SANCTIONS', 'DOW_JONES'],
      subtype: 'FUZZINESS_SETTINGS',
    }),
    title: options?.title || 'Fuzziness settings',
    description:
      options?.description || `Select a method for calculating fuzziness`,
    enum: FUZZINESS_SETTING_OPTIONSS,
  } as const)

export const PEP_RANK_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      requiredFeatures: ['DOW_JONES'],
    }),
    type: 'string',
    enum: PEP_RANK_VALUES,
    title: options?.title || 'PEP rank',
    description:
      options?.description ??
      'Select the PEP rank to be used for the screening',
    nullable: true,
    uniqueItems: true,
    enumNames: PEP_RANK_VALUES.map((rank) => humanizeAuto(rank)),
  } as const)

export const ENABLE_ONGOING_SCREENING_SCHEMA = (options?: SchemaOptions) =>
  ({
    type: 'boolean',
    title: options?.title || 'Enable ongoing screening',
    description: options?.description,
  } as const)

export const USER_KYC_STATUS_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'KYC_STATUS',
    }),
    type: 'array',
    title: options?.title || '{{UserAlias}} KYC status',
    description:
      options?.description ||
      'Select one or more {{userAlias}} KYC status to target transactions for those {{userAlias}}s',
    items: {
      type: 'string',
      enum: KYC_STATUSS,
      enumNames: KYC_STATUSS.map((segment) =>
        startCase(segment.replace('_', ' ').toLowerCase())
      ),
    },
    uniqueItems: true,
  } as const)

export const USER_KYC_STATUS_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...USER_KYC_STATUS_SCHEMA(options),
    nullable: true,
  } as const)

export const USER_STATUS_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...uiSchema(options?.uiSchema, {
      subtype: 'USER_STATUS',
    }),
    type: 'array',
    title: options?.title || '{{UserAlias}} status',
    description:
      options?.description ||
      'Select one or more {{userAlias}} status states to target transactions for those {{userAlias}}s',
    items: {
      type: 'string',
      enum: USER_STATES,
      enumNames: USER_STATES.map((segment) =>
        startCase(segment.replace('_', ' ').toLowerCase())
      ),
    },
    uniqueItems: true,
  } as const)

export const USER_STATUS_OPTIONAL_SCHEMA = (options?: SchemaOptions) =>
  ({
    ...USER_STATUS_SCHEMA(options),
    nullable: true,
  } as const)

export type AlertCreatedForEnum = 'PAYMENT_DETAILS' | 'USER'
