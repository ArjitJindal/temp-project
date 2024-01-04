import { lowerCase, startCase } from 'lodash'
import { TRANSACTION_STATE } from './transaction-state'
import { TRANSACTION_TYPE } from './transaction-type'
import {
  BusinessUserRuleVariable,
  ConsumerUserRuleVariable,
  RuleVariable,
  TransactionRuleVariable,
} from './types'
import {
  TRANSACTION_DESTINATION_COUNTRY,
  TRANSACTION_ORIGIN_COUNTRY,
} from './transaction-country'
import { TRANSACTION_PRODUCT_TYPE } from './transaction-product-types'
import {
  CONSUMER_USER_CREATION_AGE_DAYS,
  CONSUMER_USER_CREATION_AGE_MONTHS,
  CONSUMER_USER_CREATION_AGE_YEARS,
  BUSINESS_USER_CREATION_AGE_DAYS,
  BUSINESS_USER_CREATION_AGE_MONTHS,
  BUSINESS_USER_CREATION_AGE_YEARS,
} from './user-creation-age'
import {
  CONSUMER_USER_ACQUISITION_CHANNEL,
  BUSINESS_USER_ACQUISITION_CHANNEL,
} from './user-acquisition-channel'
import { TRANSACTION_ID } from './transaction-id'
import {
  BUSINESS_USER_AGE_DAYS,
  BUSINESS_USER_AGE_MONTHS,
  BUSINESS_USER_AGE_YEARS,
  CONSUMER_USER_AGE_DAYS,
  CONSUMER_USER_AGE_MONTHS,
  CONSUMER_USER_AGE_YEARS,
} from './user-age'

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

const TRANSACTION_VARIABLES: TransactionRuleVariable[] = [
  TRANSACTION_TYPE,
  TRANSACTION_STATE,
  TRANSACTION_PRODUCT_TYPE,
  TRANSACTION_ORIGIN_COUNTRY,
  TRANSACTION_DESTINATION_COUNTRY,
  TRANSACTION_ID,
]
const USER_VARIABLES: Array<
  ConsumerUserRuleVariable | BusinessUserRuleVariable
> = [
  CONSUMER_USER_AGE_DAYS,
  CONSUMER_USER_AGE_MONTHS,
  CONSUMER_USER_AGE_YEARS,
  CONSUMER_USER_CREATION_AGE_DAYS,
  CONSUMER_USER_CREATION_AGE_MONTHS,
  CONSUMER_USER_CREATION_AGE_YEARS,
  CONSUMER_USER_ACQUISITION_CHANNEL,
  BUSINESS_USER_AGE_DAYS,
  BUSINESS_USER_AGE_MONTHS,
  BUSINESS_USER_AGE_YEARS,
  BUSINESS_USER_CREATION_AGE_DAYS,
  BUSINESS_USER_CREATION_AGE_MONTHS,
  BUSINESS_USER_CREATION_AGE_YEARS,
  BUSINESS_USER_ACQUISITION_CHANNEL,
]

export const RULE_VARIABLES: RuleVariable[] = [
  ...TRANSACTION_VARIABLES,
  ...USER_VARIABLES,
].map((v) => withNamespace(v))

export function getRuleVariableByKey(key: string): RuleVariable | undefined {
  return RULE_VARIABLES.find((v) => v.key === key)
}
