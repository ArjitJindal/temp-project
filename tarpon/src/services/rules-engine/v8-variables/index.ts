import { lowerCase, startCase } from 'lodash'
import { TRANSACTION_TYPE } from './transaction-type'
import { RuleVariable } from './types'
import { TRANSACTION_PRODUCT_TYPE } from './transaction-product-types'
import {
  TRANSACTION_DESTINATION_COUNTRY,
  TRANSACTION_ORIGIN_COUNTRY,
} from './transaction-country'

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
  TRANSACTION_PRODUCT_TYPE,
  TRANSACTION_ORIGIN_COUNTRY,
  TRANSACTION_DESTINATION_COUNTRY,
].map((v) => withNamespace(v))

export function getRuleVariableByKey(key: string): RuleVariable | undefined {
  return RULE_VARIABLES.find((v) => v.key === key)
}
