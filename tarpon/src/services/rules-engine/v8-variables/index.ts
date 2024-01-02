import { lowerCase, startCase } from 'lodash'
import { TRANSACTION_STATE } from './transaction-state'
import { TRANSACTION_TYPE } from './transaction-type'
import { RuleVariable } from './types'
import { USER_AGE_DAYS, USER_AGE_MONTHS, USER_AGE_YEARS } from './user-age'
import {
  TRANSACTION_DESTINATION_COUNTRY,
  TRANSACTION_ORIGIN_COUNTRY,
} from './transaction-country'
import { TRANSACTION_PRODUCT_TYPE } from './transaction-product-types'
import {
  USER_CREATION_AGE_DAYS,
  USER_CREATION_AGE_MONTHS,
  USER_CREATION_AGE_YEARS,
} from './user-creation-age'
import { TRANSACTION_ID } from './transaction-id'

function withNamespace(variable: RuleVariable) {
  return {
    ...variable,
    key: `${variable.entity}:${variable.key}`,
    uiDefinition: {
      ...variable.uiDefinition,
      label: `${startCase(lowerCase(variable.entity))} / ${
        variable.uiDefinition.label
      }`,
    },
  }
}

export const RULE_VARIABLES: RuleVariable[] = [
  TRANSACTION_TYPE,
  TRANSACTION_STATE,
  USER_AGE_DAYS,
  USER_AGE_MONTHS,
  USER_AGE_YEARS,
  USER_CREATION_AGE_DAYS,
  USER_CREATION_AGE_MONTHS,
  USER_CREATION_AGE_YEARS,
  TRANSACTION_PRODUCT_TYPE,
  TRANSACTION_ORIGIN_COUNTRY,
  TRANSACTION_DESTINATION_COUNTRY,
  TRANSACTION_ID,
].map((v) => withNamespace(v))

export function getRuleVariableByKey(key: string): RuleVariable | undefined {
  return RULE_VARIABLES.find((v) => v.key === key)
}
