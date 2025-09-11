import { JSONSchemaType } from 'ajv'

import isEmpty from 'lodash/isEmpty'
import {
  CheckDirectionRuleFilter,
  CheckDirectionRuleFilterParameter,
} from './transaction-filters/check-direction'
import { TransactionRuleFilter } from './transaction-filters/filter'
import {
  PaymentMethodHistoricalRuleFilter,
  PaymentMethodHistoricalRuleFilterParameter,
} from './transaction-filters/payment-method-historical'
import {
  TransactionAmountRuleFilter,
  TransactionAmountRuleFilterParameter,
} from './transaction-filters/transaction-amount'
import {
  TransactionCountryHistoricalRuleFilter,
  TransactionCountryHistoricalRuleFilterParameter,
} from './transaction-filters/transaction-country-historical'
import {
  TransactionStateRuleFilter,
  TransactionStateRuleFilterParameter,
} from './transaction-filters/transaction-state'
import {
  TransactionStateHistoricalRuleFilter,
  TransactionStateHistoricalRuleFilterParameter,
} from './transaction-filters/transaction-state-historical'
import {
  TransactionTypeRuleFilter,
  TransactionTypeRuleFilterParameter,
} from './transaction-filters/transaction-type'
import {
  TransactionTypeHistoricalRuleFilter,
  TransactionTypeHistoricalRuleFilterParameter,
} from './transaction-filters/transaction-type-historical'
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
  UserIdRuleFilter,
  UserIdRuleFilterParameter,
} from './user-filters/user-id'
import {
  UserTypeRuleFilter,
  UserTypeRuleFilterParameter,
} from './user-filters/user-type'
import {
  WhitelistUsersRuleFilter,
  WhitelistUsersRuleFilterParameter,
} from './user-filters/whitelist-users'
import {
  UserAcquisitionChannelRuleFilter,
  UserAcquisitionChannelRuleFilterParameter,
} from './user-filters/user-acquisition-channel'
import {
  TransactionAmountHistoricalRuleFilter,
  TransactionAmountHistoricalRuleFilterParameter,
} from './transaction-filters/transaction-amount-historical'
import {
  ConsumerUserSegmentRuleFilter,
  ConsumerUserSegmentRuleFilterParameter,
} from './user-filters/user-consumer-segment'
import {
  TransactionProductTypesRuleFilter,
  TransactionProductTypesRuleFilterParameter,
} from './transaction-filters/transaction-product-types'
import {
  UserKycStatusRuleFilter,
  UserKycStatusRuleFilterParameter,
} from './user-filters/user-kyc-status'
import {
  UserStatusRuleFilter,
  UserStatusRuleFilterParameter,
} from './user-filters/user-status'
import {
  UserTagsRuleFilter,
  UserTagsRuleFilterParameter,
} from './user-filters/user-tags'
import {
  TransactionTagsRuleFilter,
  TransactionTagsRuleFilterParameter,
} from './transaction-filters/transaction-tags'
import {
  BusinessUserSegmentRuleFilter,
  BusinessUserSegmentRuleFilterParameter,
} from './user-filters/user-business-consumer-segment'
import {
  TransactionTimeRangeRuleFilter,
  TransactionTimeRangeRuleFilterParameter,
} from './transaction-filters/transaction-time-range'
import {
  TransactionTimeRangeHistoricalRuleFilter,
  TransactionTimeRangeHistoricalRuleFilterParameter,
} from './transaction-filters/transaction-time-range-historical'
import { OriginPaymentFilterRuleFilter } from './transaction-filters/origin-payment-filter'
import { DestinationPaymentFilterRuleFilter } from './transaction-filters/destination-payment-filter'
import {
  DestinationPaymentRuleFiltersParameters,
  OriginPaymentRuleFiltersParameters,
} from './transaction-filters/payment-filters-base'
import { OriginTransactionCountryRuleFilter } from './transaction-filters/origin-transaction-country'
import {
  DestinationTransactionCountryRuleFilterParameter,
  OriginTransactionCountryRuleFilterParameter,
} from './transaction-filters/transaction-country-base'
import { DestinationTransactionCountryRuleFilter } from './transaction-filters/destination-transaction-country'

export type TransactionFilters = OriginPaymentRuleFiltersParameters &
  DestinationPaymentRuleFiltersParameters &
  TransactionTypeRuleFilterParameter &
  TransactionStateRuleFilterParameter &
  OriginTransactionCountryRuleFilterParameter &
  DestinationTransactionCountryRuleFilterParameter &
  CheckDirectionRuleFilterParameter &
  TransactionAmountRuleFilterParameter &
  TransactionProductTypesRuleFilterParameter &
  TransactionTagsRuleFilterParameter &
  TransactionTimeRangeRuleFilterParameter

export type TransactionHistoricalFilters =
  TransactionStateHistoricalRuleFilterParameter &
    TransactionTypeHistoricalRuleFilterParameter &
    PaymentMethodHistoricalRuleFilterParameter &
    TransactionCountryHistoricalRuleFilterParameter &
    TransactionAmountHistoricalRuleFilterParameter &
    TransactionTimeRangeHistoricalRuleFilterParameter

export type UserFilters = WhitelistUsersRuleFilterParameter &
  UserCreationAgeRuleFilterParameter &
  UserTypeRuleFilterParameter &
  UserAgeRuleFilterParameter &
  UserIdRuleFilterParameter &
  UserCountryOfResidenceRuleFilterParameter &
  UserCountryOfNationalityRuleFilterParameter &
  UserCountryOfRegistrationRuleFilterParameter &
  UserAcquisitionChannelRuleFilterParameter &
  ConsumerUserSegmentRuleFilterParameter &
  BusinessUserSegmentRuleFilterParameter &
  UserKycStatusRuleFilterParameter &
  UserStatusRuleFilterParameter &
  UserTagsRuleFilterParameter

export type LegacyFilters = TransactionFilters &
  TransactionHistoricalFilters &
  UserFilters

export type TransactionFilterKeys = keyof TransactionFilters
export type TransactionHistoricalFilterKeys = keyof TransactionHistoricalFilters
export type UserFilterKeys = keyof UserFilters

const _TRANSACTION_FILTERS = [
  OriginPaymentFilterRuleFilter,
  DestinationPaymentFilterRuleFilter,
  TransactionTypeRuleFilter,
  TransactionStateRuleFilter,
  OriginTransactionCountryRuleFilter,
  DestinationTransactionCountryRuleFilter,
  TransactionAmountRuleFilter,
  CheckDirectionRuleFilter,
  TransactionProductTypesRuleFilter,
  TransactionTagsRuleFilter,
  TransactionTimeRangeRuleFilter,
]

const _TRANSACTION_HISTORICAL_FILTERS = [
  PaymentMethodHistoricalRuleFilter,
  TransactionTypeHistoricalRuleFilter,
  TransactionStateHistoricalRuleFilter,
  TransactionCountryHistoricalRuleFilter,
  TransactionAmountHistoricalRuleFilter,
  TransactionTimeRangeHistoricalRuleFilter,
]

// Order defined here will be reflected in console
const _USER_FILTERS = [
  UserTypeRuleFilter,
  ConsumerUserSegmentRuleFilter,
  BusinessUserSegmentRuleFilter,
  UserAgeRuleFilter,
  UserCreationAgeRuleFilter,
  WhitelistUsersRuleFilter,
  UserIdRuleFilter,
  UserCountryOfResidenceRuleFilter,
  UserCountryOfNationalityRuleFilter,
  UserCountryOfRegistrationRuleFilter,
  UserAcquisitionChannelRuleFilter,
  UserKycStatusRuleFilter,
  UserStatusRuleFilter,
  UserTagsRuleFilter,
]

function createFiltersMap<T>(filters: Array<any>): { [key: string]: T } {
  return Object.fromEntries(
    filters.map((filter) => {
      const { properties } = filter.getSchema() as JSONSchemaType<unknown>
      const keys = Object.keys(properties)
      return [keys, filter]
    })
  )
}

function createDefaultValuesMap<T>(filters: Array<any>): { [key: string]: T } {
  const filteredDefaultValues = filters.filter(
    (filter) => !isEmpty(filter?.getDefaultValues())
  )

  return Object.fromEntries(
    filteredDefaultValues.map((filter) => {
      const object = filter.getDefaultValues()
      const keys = Object.keys(object)
      if (Object.keys(object).length !== 1) {
        throw new Error('Rule filter can only have one key')
      }
      return [keys[0], filter]
    })
  )
}

export class UserRuleFilterBase extends UserRuleFilter<unknown> {
  public async predicate(): Promise<boolean> {
    return true
  }
}
export class TransactionRuleFilterBase extends TransactionRuleFilter<unknown> {
  public async predicate(): Promise<boolean> {
    return true
  }
}

export const TRANSACTION_FILTERS =
  createFiltersMap<typeof TransactionRuleFilterBase>(_TRANSACTION_FILTERS)
export const TRANSACTION_HISTORICAL_FILTERS = createFiltersMap<
  typeof TransactionRuleFilterBase
>(_TRANSACTION_HISTORICAL_FILTERS)
export const USER_FILTERS =
  createFiltersMap<typeof UserRuleFilterBase>(_USER_FILTERS)
export const TRANSACTION_FILTER_DEFAULT_VALUES = createDefaultValuesMap<
  typeof TransactionRuleFilterBase
>([..._TRANSACTION_FILTERS, ..._TRANSACTION_HISTORICAL_FILTERS])

if (
  _TRANSACTION_FILTERS.length +
    _USER_FILTERS.length +
    _TRANSACTION_HISTORICAL_FILTERS.length !==
  new Set([
    ...Object.keys(TRANSACTION_FILTERS),
    ...Object.keys(USER_FILTERS),
    ...Object.keys(TRANSACTION_HISTORICAL_FILTERS),
  ]).size
) {
  throw new Error('Duplicate rule filter keys found')
}
