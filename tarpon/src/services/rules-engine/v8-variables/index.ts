import { get, lowerCase, startCase, memoize, groupBy, mapValues } from 'lodash'
import { FieldOrGroup, ValueSource } from '@react-awesome-query-builder/core'
import {
  BusinessUserRuleVariable,
  CommonUserRuleVariable,
  ConsumerUserRuleVariable,
  RuleEntityType,
  RuleVariableBase as RuleVariable,
  TransactionRuleVariable,
  RuleVariableContext,
  TransactionEventRuleVariable,
} from './types'
import {
  CONSUMER_USER_CREATION_AGE_DAYS,
  CONSUMER_USER_CREATION_AGE_MONTHS,
  CONSUMER_USER_CREATION_AGE_YEARS,
  BUSINESS_USER_CREATION_AGE_DAYS,
  BUSINESS_USER_CREATION_AGE_MONTHS,
  BUSINESS_USER_CREATION_AGE_YEARS,
} from './user-creation-age'
import {
  BUSINESS_USER_AGE_DAYS,
  BUSINESS_USER_AGE_MONTHS,
  BUSINESS_USER_AGE_YEARS,
  CONSUMER_USER_AGE_DAYS,
  CONSUMER_USER_AGE_MONTHS,
  CONSUMER_USER_AGE_YEARS,
} from './user-age'
import {
  ARRAY_ITEM_INDICATOR,
  EntityLeafValueInfo,
  EntityModel,
  getPublicModelLeafAttrs,
} from './utils'
import { USER_TYPE } from './user-type'
import { TRANSACTION_TIME } from './transaction-time'
import {
  TRANSACTION_DESTINATION_PAYMENT_DETAILS_IDENTIFIER,
  TRANSACTION_ORIGIN_PAYMENT_DETAILS_IDENTIFIER,
} from './payment-details'
import {
  SENDING_TRANSACTIONS_COUNT,
  RECEIVING_TRANSACTIONS_COUNT,
} from './transactions-count'
import { TRANSACTION_TRS_SCORE } from './trs-score'
import {
  TRANSACTION_DESTINATION_IP_CITY_VARIABLE,
  TRANSACTION_ORIGIN_IP_CITY_VARIABLE,
  TRANSACTION_DESTINATION_IP_COUNTRY_VARIABLE,
  TRANSACTION_ORIGIN_IP_COUNTRY_VARIABLE,
} from './transaction-ip-info'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { CurrencyService } from '@/services/currency'
import { logger } from '@/core/logger'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'
import { TransactionEvent } from '@/@types/openapi-public/TransactionEvent'

const currencyService = new CurrencyService()

export const VARIABLE_NAMESPACE_SEPARATOR = ':'
const ORIGIN_TRANSACTION_AMOUNT_KEY = 'originAmountDetails.transactionAmount'
const DESTINATION_TRANSACTION_AMOUNT_KEY =
  'destinationAmountDetails.transactionAmount'

function withNamespace(variable: RuleVariable) {
  return {
    ...variable,
    key: `${
      variable.entity
    }${VARIABLE_NAMESPACE_SEPARATOR}${variable.key.replace(/\./g, '-')}`,
    uiDefinition: {
      ...variable.uiDefinition,
      label: `${startCase(lowerCase(variable.entity))} / ${
        variable.uiDefinition.label
      }`,
    },
  }
}

export function isAggregationVariable(key: string): boolean {
  return key.startsWith('agg:')
}

const SENDER_VARIABLE_KEY_SUFFIX = '__SENDER'
const RECEIVER_VARIABLE_KEY_SUFFIX = '__RECEIVER'
const BOTH_DIRECTIONS_VARIABLE_KEY_SUFFIX = '__BOTH'
export function isSenderUserVariable(variable: RuleVariable) {
  return variable.key.endsWith(SENDER_VARIABLE_KEY_SUFFIX)
}
export function isReceiverUserVariable(variable: RuleVariable) {
  return variable.key.endsWith(RECEIVER_VARIABLE_KEY_SUFFIX)
}
export function isDirectionLessVariable(variableKey: string) {
  return variableKey.endsWith(BOTH_DIRECTIONS_VARIABLE_KEY_SUFFIX)
}
export function getDirectionalVariableKeys(directionLessVariableKey: string) {
  const key = directionLessVariableKey.replace(
    BOTH_DIRECTIONS_VARIABLE_KEY_SUFFIX,
    ''
  )
  if (directionLessVariableKey.startsWith('TRANSACTION')) {
    const parts = key.split(VARIABLE_NAMESPACE_SEPARATOR)
    const entity = parts[0]
    const part = `${parts[1].charAt(0).toUpperCase()}${parts[1].slice(1)}`
    return [
      `${entity}${VARIABLE_NAMESPACE_SEPARATOR}origin${part}`,
      `${entity}${VARIABLE_NAMESPACE_SEPARATOR}destination${part}`,
    ]
  } else {
    return [
      `${key}${SENDER_VARIABLE_KEY_SUFFIX}`,
      `${key}${RECEIVER_VARIABLE_KEY_SUFFIX}`,
    ]
  }
}

function txEntityVariableWithoutDirection(variables: RuleVariable[]) {
  return variables.flatMap((variable) => {
    if (!variable.key.startsWith('origin')) {
      return [variable]
    }
    // Add one more direction-less variable for variables with direction
    let updatedKey = variable.key.replace(/^origin/, '')
    updatedKey = updatedKey.charAt(0).toLowerCase() + updatedKey.slice(1)
    const updatedLabel = variable.uiDefinition.label?.replace(/^origin\s+/, '')
    return [
      variable,
      {
        ...variable,
        key: `${updatedKey}${BOTH_DIRECTIONS_VARIABLE_KEY_SUFFIX}`,
        uiDefinition: {
          ...variable.uiDefinition,
          label: `${updatedLabel} (origin or destination)`,
        },
        load: async () => null,
      },
    ]
  })
}

function userEntityVariableWithDirection(variables: RuleVariable[]) {
  return variables.flatMap((variable) => [
    {
      ...variable,
      key: `${variable.key}${SENDER_VARIABLE_KEY_SUFFIX}`,
    },
    {
      ...variable,
      key: `${variable.key}${RECEIVER_VARIABLE_KEY_SUFFIX}`,
    },
    {
      ...variable,
      key: `${variable.key}${BOTH_DIRECTIONS_VARIABLE_KEY_SUFFIX}`,
      load: async () => null,
    },
  ])
}

const TRANSACTION_DERIVED_VARIABLES = [
  TRANSACTION_TIME,
  TRANSACTION_ORIGIN_PAYMENT_DETAILS_IDENTIFIER,
  TRANSACTION_DESTINATION_PAYMENT_DETAILS_IDENTIFIER,
  TRANSACTION_TRS_SCORE,
  TRANSACTION_ORIGIN_IP_CITY_VARIABLE,
  TRANSACTION_DESTINATION_IP_CITY_VARIABLE,
  TRANSACTION_DESTINATION_IP_COUNTRY_VARIABLE,
  TRANSACTION_ORIGIN_IP_COUNTRY_VARIABLE,
]

const USER_DERIVED_VARIABLES: Array<
  ConsumerUserRuleVariable | BusinessUserRuleVariable | CommonUserRuleVariable
> = [
  USER_TYPE,
  CONSUMER_USER_AGE_DAYS,
  CONSUMER_USER_AGE_MONTHS,
  CONSUMER_USER_AGE_YEARS,
  CONSUMER_USER_CREATION_AGE_DAYS,
  CONSUMER_USER_CREATION_AGE_MONTHS,
  CONSUMER_USER_CREATION_AGE_YEARS,
  BUSINESS_USER_AGE_DAYS,
  BUSINESS_USER_AGE_MONTHS,
  BUSINESS_USER_AGE_YEARS,
  BUSINESS_USER_CREATION_AGE_DAYS,
  BUSINESS_USER_CREATION_AGE_MONTHS,
  BUSINESS_USER_CREATION_AGE_YEARS,
  SENDING_TRANSACTIONS_COUNT,
  RECEIVING_TRANSACTIONS_COUNT,
]

function isTimestampVariable(key: string): boolean {
  return key.toLowerCase().endsWith('timestamp')
}

function getUiDefinitionType(leafInfo: EntityLeafValueInfo) {
  if (leafInfo.options && leafInfo.options.length > 0) {
    // IMPORTANT: We se the type to 'text' instead of 'select' then we can compare 'text' type variable
    // with 'select' type variable
    return 'text'
  }

  if (isTimestampVariable(leafInfo.pathKey)) {
    return 'datetime'
  }

  switch (leafInfo.type) {
    case 'string':
      return 'text'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'text'
  }
}

function updatedTransactionEntityVariables(
  variables: TransactionRuleVariable[]
) {
  const originAmountVariable = variables.find(
    (v) => v.key === ORIGIN_TRANSACTION_AMOUNT_KEY
  )
  const destinationAmountVariable = variables.find(
    (v) => v.key === DESTINATION_TRANSACTION_AMOUNT_KEY
  )
  const loadTransactionAmount = async (
    amountDetails: TransactionAmountDetails | undefined,
    context?: RuleVariableContext
  ): Promise<number | undefined> => {
    if (!amountDetails) {
      return NaN
    }
    if (!context?.baseCurrency) {
      throw new Error('Missing base currency for transaction amount variable!')
    }
    const amount = await currencyService.getTargetCurrencyAmount(
      amountDetails,
      context?.baseCurrency ?? 'USD'
    )
    return amount.transactionAmount ?? NaN
  }
  if (originAmountVariable) {
    originAmountVariable.load = async (transaction, context) => {
      return await loadTransactionAmount(
        transaction?.originAmountDetails,
        context
      )
    }
  } else {
    logger.error('Cannot find origin amount variable')
  }
  if (destinationAmountVariable) {
    destinationAmountVariable.load = async (transaction, context) => {
      return await loadTransactionAmount(
        transaction?.destinationAmountDetails,
        context
      )
    }
  } else {
    logger.error('Cannot find destination amount variable')
  }
}

const getTransactionEntityVariables = memoize(
  (): { [key: string]: TransactionRuleVariable } => {
    const transactionAutoRuleEntityVariables = getAutoRuleEntityVariables(
      'TRANSACTION',
      Transaction
    ).map(
      (variable) =>
        ({
          ...variable,
          sourceField: variable.key.split('.')[0],
        } as TransactionRuleVariable)
    )
    const transactionEntityVariables = [
      ...transactionAutoRuleEntityVariables,
      ...TRANSACTION_DERIVED_VARIABLES,
    ]
    return Object.fromEntries(transactionEntityVariables.map((v) => [v.key, v]))
  }
)
const getTransactionEventVariables = memoize(
  (): { [key: string]: TransactionEventRuleVariable } => {
    const transactionEntityVariables = getAutoRuleEntityVariables(
      'TRANSACTION_EVENT',
      TransactionEvent,
      ['updatedTransactionAttributes']
    ) as TransactionEventRuleVariable[]
    return Object.fromEntries(transactionEntityVariables.map((v) => [v.key, v]))
  }
)

export const getTransactionRuleEntityVariables = memoize(
  (): { [key: string]: RuleVariable } => {
    const transactionEntityVariables = Object.values(
      getTransactionEntityVariables()
    )
    const transactionEventVariables = Object.values(
      getTransactionEventVariables()
    )
    updatedTransactionEntityVariables(
      transactionEntityVariables as TransactionRuleVariable[]
    )
    const consumerUserEntityVariables = getAutoRuleEntityVariables(
      'CONSUMER_USER',
      User
    )
    const businessUserEntityVariables = getAutoRuleEntityVariables(
      'BUSINESS_USER',
      Business
    )
    return Object.fromEntries(
      [
        ...txEntityVariableWithoutDirection(transactionEntityVariables),
        ...transactionEventVariables,
        ...userEntityVariableWithDirection(
          consumerUserEntityVariables.concat(
            businessUserEntityVariables,
            USER_DERIVED_VARIABLES
          )
        ),
      ]
        .map(withNamespace)
        .map((v) => [v.key, v])
    )
  }
)

function getArrayUiDefinition(
  subPath: string[],
  groupLeafValueInfos: Array<
    EntityLeafValueInfo & { arrayGroupLevels: Array<string[]> }
  >
): FieldOrGroup {
  return {
    label: subPath.map(lowerCase).join(' > '),
    type: '!group',
    mode: 'array',
    conjunctions: ['AND', 'OR'],
    subfields: getAutoArrayRuleEntityVariableSubfields(
      groupLeafValueInfos.map((info) => ({
        ...info,
        arrayGroupLevels: info.arrayGroupLevels.slice(1),
      }))
    ),
  }
}

function getUiDefinition(info: EntityLeafValueInfo): FieldOrGroup {
  const type = getUiDefinitionType(info)
  const fieldSettings =
    info.options && info.options.length > 0
      ? {
          listValues: info.options,
        }
      : undefined
  return {
    label: info.path.map(lowerCase).join(' > '),
    type,
    valueSources: ['value', 'field', 'func'],
    fieldSettings,
  }
}

function getAutoRuleEntityVariables(
  entityType: RuleEntityType,
  entityClass: typeof EntityModel,
  ignoreFields: string[] = []
): RuleVariable[] {
  let leafValueInfos = getPublicModelLeafAttrs(entityClass)
  if (ignoreFields.length) {
    leafValueInfos = leafValueInfos.filter((info) =>
      ignoreFields.every((ignoreField) => !info.pathKey.startsWith(ignoreField))
    )
  }
  const nonArrayVariables: RuleVariable[] = leafValueInfos
    .filter((info) => !info.pathKey.includes(ARRAY_ITEM_INDICATOR))
    .map((info) => {
      return {
        key: info.pathKey,
        entity: entityType,
        valueType: info.type,
        uiDefinition: getUiDefinition(info),
        load: async (entity: any) => {
          const value = get(entity, info.path)
          return info.type === 'number' ? value ?? NaN : value
        },
      }
    })
  const multiselectVariables = leafValueInfos
    .filter((info) => info.pathKey.endsWith(ARRAY_ITEM_INDICATOR))
    .map((info) => {
      return getLeafArrayEntityVariables(info, entityType)
    })
  const arrayLeafValueInfos = leafValueInfos
    .filter(
      (info) =>
        info.pathKey.includes(ARRAY_ITEM_INDICATOR) &&
        !info.pathKey.endsWith(ARRAY_ITEM_INDICATOR)
    )
    .map((info) => ({
      ...info,
      arrayGroupLevels: info.pathKey
        .split(new RegExp(`\\.?\\${ARRAY_ITEM_INDICATOR}\\.?`))
        .map((v) => v.split('.')),
    }))

  return [
    ...nonArrayVariables,
    ...getAutoArrayRuleEntityVariables(entityType, arrayLeafValueInfos),
    ...multiselectVariables,
  ]
}

function getAutoArrayRuleEntityVariableSubfields(
  infos: Array<EntityLeafValueInfo & { arrayGroupLevels: Array<string[]> }>
): { [key: string]: FieldOrGroup } {
  return mapValues(
    // NOTE: object key here needs to be a subpath of the array group using '.' as the separator.
    // For example, 'nameOnDocument.firstName' for 'legalDocuments.$i.nameOnDocument.firstName'
    groupBy(infos, (v) => v.arrayGroupLevels[0].join('.')),
    (infos) => {
      if (infos.length === 1) {
        return getUiDefinition({
          ...infos[0],
          path: infos[0].arrayGroupLevels[0],
        })
      } else {
        // Nested subfields
        return getArrayUiDefinition(infos[0].arrayGroupLevels[0], infos)
      }
    }
  )
}

function getAutoArrayRuleEntityVariables(
  entityType: RuleEntityType,
  arrayLeafValueInfos: Array<
    EntityLeafValueInfo & { arrayGroupLevels: Array<string[]> }
  >
): RuleVariable[] {
  return Object.entries(
    groupBy(arrayLeafValueInfos, (v) => v.arrayGroupLevels[0].join('.'))
  ).map((entry) => {
    const arrayGroupKey = entry[0]
    const groupLeafValueInfos = entry[1]
    return {
      key: arrayGroupKey,
      entity: entityType,
      valueType: 'array',
      uiDefinition: getArrayUiDefinition(
        arrayGroupKey.split('.'),
        groupLeafValueInfos
      ),
      load: async (entity: any) => get(entity, arrayGroupKey),
    }
  })
}

function getLeafArrayEntityVariables(
  info: EntityLeafValueInfo,
  entityType: RuleEntityType
): RuleVariable {
  const path = info.path.slice(0, -1)
  const label = path.map(lowerCase).join(' > ')
  return {
    key: path.join('.'),
    entity: entityType,
    valueType: 'array',
    uiDefinition: {
      label,
      type: 'multiselect',
      preferWidgets: ['multiselect'],
      valueSources: ['value', 'field', 'func'] as ValueSource[],
      allowCustomValues: true,
    },
    load: async (entity: any) => get(entity, path),
  }
}

export function getRuleVariableByKey(key: string): RuleVariable | undefined {
  return getTransactionRuleEntityVariables()[key]
}
