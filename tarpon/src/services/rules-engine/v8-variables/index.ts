import { get, lowerCase, startCase, memoize, groupBy, mapValues } from 'lodash'
import { FieldOrGroup } from '@react-awesome-query-builder/core'
import {
  BusinessUserRuleVariable,
  CommonUserRuleVariable,
  ConsumerUserRuleVariable,
  RuleEntityType,
  RuleVariableBase as RuleVariable,
  TransactionRuleVariable,
  TransactionRuleVariableContext,
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
  TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_RECEIVER,
  TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_SENDER,
} from './payment-details'
import {
  SENDING_TRANSACTIONS_COUNT,
  RECEIVING_TRANSACTIONS_COUNT,
} from './transactions-count'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { CurrencyService } from '@/services/currency'
import { logger } from '@/core/logger'
import { TransactionAmountDetails } from '@/@types/openapi-public/TransactionAmountDetails'

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

const SENDER_VARIABLE_KEY_SUFFIX = '__SENDER'
const RECEIVER_VARIABLE_KEY_SUFFIX = '__RECEIVER'
export function isSenderUserVariable(variable: RuleVariable) {
  return variable.key.endsWith(SENDER_VARIABLE_KEY_SUFFIX)
}
export function isReceiverUserVariable(variable: RuleVariable) {
  return variable.key.endsWith(RECEIVER_VARIABLE_KEY_SUFFIX)
}
function withDirection(variables: RuleVariable[]) {
  return variables.flatMap((variable) => [
    {
      ...variable,
      key: `${variable.key}${SENDER_VARIABLE_KEY_SUFFIX}`,
      uiDefinition: {
        ...variable.uiDefinition,
        label: `${variable.uiDefinition.label} (Sender)`,
      },
    },
    {
      ...variable,
      key: `${variable.key}${RECEIVER_VARIABLE_KEY_SUFFIX}`,
      uiDefinition: {
        ...variable.uiDefinition,
        label: `${variable.uiDefinition.label} (Receiver)`,
      },
    },
  ])
}

const TRANSACTION_DERIVED_VARIABLES = [
  TRANSACTION_TIME,
  TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_SENDER,
  TRANSACTION_PAYMENT_DETAILS_IDENTIFIER_RECEIVER,
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
  return key.endsWith('timestamp') || key.endsWith('Timestamp')
}

function getUiDefinitionType(leafInfo: EntityLeafValueInfo) {
  if (leafInfo.options && leafInfo.options.length > 0) {
    return 'select'
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
  )!
  const destinationAmountVariable = variables.find(
    (v) => v.key === DESTINATION_TRANSACTION_AMOUNT_KEY
  )!
  const loadTransactionAmount = async (
    amountDetails: TransactionAmountDetails | undefined,
    context: TransactionRuleVariableContext
  ): Promise<number | undefined> => {
    if (!amountDetails) {
      return
    }
    if (!context.baseCurrency) {
      logger.error('Missing base currency for transaction amount variable!')
    }
    const amount = await currencyService.getTargetCurrencyAmount(
      amountDetails,
      context.baseCurrency ?? 'USD'
    )
    return amount.transactionAmount
  }
  originAmountVariable.load = async (transaction, context) => {
    return await loadTransactionAmount(transaction.originAmountDetails, context)
  }
  destinationAmountVariable.load = async (transaction, context) => {
    return await loadTransactionAmount(
      transaction.destinationAmountDetails,
      context
    )
  }
}

export const getTransactionEntityVariables = memoize(
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

export const getTransactionRuleEntityVariables = memoize(
  (): { [key: string]: RuleVariable } => {
    const transactionEntityVariables = Object.values(
      getTransactionEntityVariables()
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
    const userEntityVariables = withDirection(
      consumerUserEntityVariables.concat(
        businessUserEntityVariables,
        USER_DERIVED_VARIABLES
      )
    )
    return Object.fromEntries(
      [...transactionEntityVariables, ...userEntityVariables]
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
  entityClass: typeof EntityModel
): RuleVariable[] {
  const leafValueInfos = getPublicModelLeafAttrs(entityClass)
  const nonArrayVariables: RuleVariable[] = leafValueInfos
    .filter((info) => !info.pathKey.includes(ARRAY_ITEM_INDICATOR))
    .map((info) => {
      return {
        key: info.pathKey,
        entity: entityType,
        valueType: info.type,
        uiDefinition: getUiDefinition(info),
        load: async (entity: any) => get(entity, info.path),
      }
    })
  const arrayLeafValueInfos = leafValueInfos
    .filter(
      (info) =>
        info.pathKey.includes(ARRAY_ITEM_INDICATOR) &&
        // TODO (V8): Support leaf properties in string array type (e.g legalEntity.companyGeneralDetails.businessIndustry)
        !info.pathKey.endsWith(ARRAY_ITEM_INDICATOR)
    )
    .map((info) => ({
      ...info,
      arrayGroupLevels: info.pathKey
        .split(new RegExp(`\\.?\\${ARRAY_ITEM_INDICATOR}\\.?`))
        .map((v) => v.split('.')),
    }))
  return nonArrayVariables.concat(
    getAutoArrayRuleEntityVariables(entityType, arrayLeafValueInfos)
  )
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

export function getRuleVariableByKey(key: string): RuleVariable | undefined {
  return getTransactionRuleEntityVariables()[key]
}
