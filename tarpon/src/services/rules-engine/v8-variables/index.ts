import { get, lowerCase, startCase, memoize, groupBy, mapValues } from 'lodash'
import { FieldOrGroup } from '@react-awesome-query-builder/core'
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
  ARRAY_ITEM_INDICATOR,
  EntityLeafValueInfo,
  EntityModel,
  getPublicModelLeafAttrs,
} from './utils'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'

export const VARIABLE_NAMESPACE_SEPARATOR = ':'

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
  const transactionEntityVariables = getAutoRuleEntityVariables(
    'TRANSACTION',
    Transaction
  )
  const consumerUserEntityVariables = getAutoRuleEntityVariables(
    'CONSUMER_USER',
    User
  )
  const businessUserEntityVariables = getAutoRuleEntityVariables(
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
  return {
    label: info.path.map(lowerCase).join(' > '),
    type: getUiDefinitionType(info),
    valueSources: ['value', 'field', 'func'],
    fieldSettings:
      info.options && info.options.length > 0
        ? {
            listValues: info.options,
          }
        : undefined,
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
  return getAllRuleEntityVariables().find((v) => v.key === key)
}
