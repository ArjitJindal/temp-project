import { JSONSchemaType } from 'ajv'
import {
  CheckDirectionRuleFilter,
  CheckDirectionRuleFilterParameter,
} from './transaction-filters/check-direction'
import { TransactionRuleFilter } from './transaction-filters/filter'
import {
  PaymentMethodRuleFilter,
  PaymentMethodRuleFilterParameter,
} from './transaction-filters/payment-method'
import {
  TransactionAmountRuleFilter,
  TransactionAmountRuleFilterParameter,
} from './transaction-filters/transaction-amount'
import {
  CountryRuleFilter,
  CountryRuleFilterParameter,
} from './transaction-filters/transaction-country'
import {
  TransactionStateRuleFilter,
  TransactionStateRuleFilterParameter,
} from './transaction-filters/transaction-state'
import {
  TransactionTypeRuleFilter,
  TransactionTypeRuleFilterParameter,
} from './transaction-filters/transaction-type'
import { UserRuleFilter } from './user-filters/filter'
import {
  UserAgeRuleFilter,
  UserAgeRuleFilterParameter,
} from './user-filters/user-age'
import {
  UserCountryOfNationalityRuleFilter,
  UserCountryOfNationalityRuleFilterParameter,
} from './user-filters/user-country-of-nationality'
import {
  UserCountryOfRegistrationRuleFilter,
  UserCountryOfRegistrationRuleFilterParameter,
} from './user-filters/user-country-of-registration'
import {
  UserCountryOfResidenceRuleFilter,
  UserCountryOfResidenceRuleFilterParameter,
} from './user-filters/user-country-of-residence'
import {
  UserCreationAgeRuleFilter,
  UserCreationAgeRuleFilterParameter,
} from './user-filters/user-creation-age'
import {
  UserTypeRuleFilter,
  UserTypeRuleFilterParameter,
} from './user-filters/user-type'
import {
  WhitelistUsersRuleFilter,
  WhitelistUsersRuleFilterParameter,
} from './user-filters/whitelist-users'

export type TransactionFilters = PaymentMethodRuleFilterParameter &
  TransactionTypeRuleFilterParameter &
  TransactionStateRuleFilterParameter &
  CountryRuleFilterParameter &
  CheckDirectionRuleFilterParameter &
  TransactionAmountRuleFilterParameter

export type UserFilters = WhitelistUsersRuleFilterParameter &
  UserCreationAgeRuleFilterParameter &
  UserTypeRuleFilterParameter &
  UserAgeRuleFilterParameter &
  UserCountryOfResidenceRuleFilterParameter &
  UserCountryOfNationalityRuleFilterParameter &
  UserCountryOfRegistrationRuleFilterParameter

export type TransactionFilterKeys = keyof TransactionFilters
export type UserFilterKeys = keyof UserFilters

const _TRANSACTION_FILTERS = [
  PaymentMethodRuleFilter,
  TransactionTypeRuleFilter,
  TransactionStateRuleFilter,
  CountryRuleFilter,
  TransactionAmountRuleFilter,
  CheckDirectionRuleFilter,
]

const _USER_FILTERS = [
  WhitelistUsersRuleFilter,
  UserCreationAgeRuleFilter,
  UserAgeRuleFilter,
  UserTypeRuleFilter,
  UserCountryOfResidenceRuleFilter,
  UserCountryOfNationalityRuleFilter,
  UserCountryOfRegistrationRuleFilter,
]

function createFiltersMap<T>(filters: Array<any>): { [key: string]: T } {
  return Object.fromEntries(
    filters.map((filter) => {
      const { properties } = filter.getSchema() as JSONSchemaType<unknown>
      const keys = Object.keys(properties)
      if (Object.keys(properties).length !== 1) {
        throw new Error('Rule filter can only have one key')
      }
      return [keys[0], filter]
    })
  )
}

class UserRuleFilterBase extends UserRuleFilter<unknown> {
  public async predicate(): Promise<boolean> {
    return true
  }
}
class TransactionRuleFilterBase extends TransactionRuleFilter<unknown> {
  public async predicate(): Promise<boolean> {
    return true
  }
}

export const TRANSACTION_FILTERS =
  createFiltersMap<typeof TransactionRuleFilterBase>(_TRANSACTION_FILTERS)
export const USER_FILTERS =
  createFiltersMap<typeof UserRuleFilterBase>(_USER_FILTERS)

if (
  _TRANSACTION_FILTERS.length + _USER_FILTERS.length !==
  new Set([...Object.keys(TRANSACTION_FILTERS), ...Object.keys(USER_FILTERS)])
    .size
) {
  throw new Error('Duplicate rule filter keys found')
}
