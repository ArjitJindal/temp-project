import { get, lowerCase, startCase, memoize } from 'lodash'
import {
  BusinessUserRuleVariable,
  ConsumerUserRuleVariable,
  RuleEntityType,
  RuleVariableBase as RuleVariable,
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
  EntityLeafValueInfo,
  EntityModel,
  getPublicModelLeafAttrs,
} from './utils'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'

function withNamespace(variable: RuleVariable) {
  return {
    ...variable,
    key: `${variable.entity}:${variable.key.replace(/\./g, '-')}`,
    uiDefinition: {
      ...variable.uiDefinition,
      label: `${startCase(lowerCase(variable.entity))} / ${
        variable.uiDefinition.label
      }`,
    },
  }
}

const USER_DERIVED_VARIABLES: Array<
  ConsumerUserRuleVariable | BusinessUserRuleVariable
> = [
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
]

function getUiDefinitionType(leafInfo: EntityLeafValueInfo) {
  if (leafInfo.options && leafInfo.options.length > 0) {
    return 'select'
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

export const getAllRuleEntityVariables = memoize((): RuleVariable[] => {
  const transactionEntityVariables = getAutoRuleEnvityVariables(
    'TRANSACTION',
    Transaction
  )
  const consumerUserEntityVariables = getAutoRuleEnvityVariables(
    'CONSUMER_USER',
    User
  )
  const businessUserEntityVariables = getAutoRuleEnvityVariables(
    'BUSINESS_USER',
    Business
  )
  return [
    ...transactionEntityVariables,
    ...consumerUserEntityVariables,
    ...businessUserEntityVariables,
    ...USER_DERIVED_VARIABLES,
  ].map(withNamespace)
})

function getAutoRuleEnvityVariables(
  entityType: RuleEntityType,
  entityClass: typeof EntityModel
): RuleVariable[] {
  const leafValueInfos = getPublicModelLeafAttrs(entityClass)
  return leafValueInfos.map((info) => {
    return {
      key: info.pathKey,
      entity: entityType,
      valueType: info.type,
      uiDefinition: {
        label: info.path.map(lowerCase).join(' > '),
        type: getUiDefinitionType(info),
        valueSources: ['value', 'field', 'func'],
        fieldSettings:
          info.options && info.options.length > 0
            ? {
                listValues: info.options,
              }
            : undefined,
      },
      load: async (entity: any) => get(entity, info.path),
    }
  })
}

export function getRuleVariableByKey(key: string): RuleVariable | undefined {
  return getAllRuleEntityVariables().find((v) => v.key === key)
}
