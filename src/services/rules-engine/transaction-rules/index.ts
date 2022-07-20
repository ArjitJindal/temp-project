import CardIssuedCountryRule from './card-issued-country'
import ConsecutiveTransactionsameTypeRule from './consecutive-transactions-same-type'
import FirstActivityAfterLongTimeRule from './first-activity-after-time-period'
import FirstPaymentRule from './first-payment'
import HighRiskCurrencyRule from './high-risk-currency'
import IpAddressMultipleUsersRule from './ip-address-multiple-users'
import IpAddressUnexpectedLocationRule from './ip-address-unexpected-location'
import LowValueIncomingTransactionsRule from './low-value-incoming-transactions'
import LowValueOutgoingTransactionsRule from './low-value-outgoing-transactions'
import MultipleCounterpartySendersWithinTimePeriodRule from './multiple-counterparty-senders-within-time-period'
import MultipleUserSendersWithinTimePeriodRule from './multiple-user-senders-within-time-period'
import { TransactionRule } from './rule'
import SenderLocationChangesFrequencyRule from './sender-location-changes-frequency'
import TestFailureRule from './tests/test-failure-rule'
import TestNonHitRule from './tests/test-non-hit-rule'
import TestSuccessRule from './tests/test-success-rule'
import TransactionAmountRule from './transaction-amount'
import TransactionAmountUserLimitRule from './transaction-amount-user-limit'
import TransactionNewCountryRule from './transaction-new-country'
import TransactionNewCurrencyRule from './transaction-new-currency'
import TransactionReferenceKeywordRule from './transaction-reference-keyword'
import TransactionsVelocityRule from './transactions-velocity'
import TransactionsVolumeRule from './transactions-volume'
import TransactionsVolumeQuantilesRule from './transactions-volume-quantiles'
import UserTransactionPairsRule from './user-transaction-pairs'
import TransactionMatchesPatternRule from './transaction-amount-pattern'
import MerchantReceiverNameRule from './merchant-receiver-name'
import BlacklistCardIssuedCountryRule from './blacklist-card-issued-country'
import CardHolderNameRule from './card-holder-name-levensthein-distance'
import HighTrafficBetweenSameParties from './high-traffic-between-same-parties'
import ToomanyUsersForSameCardRule from './too-many-users-for-same-card'

export const TRANSACTION_RULES = {
  // R-114
  'card-issued-country': CardIssuedCountryRule,

  // R-101
  'consecutive-transactions-same-type': ConsecutiveTransactionsameTypeRule,

  // R-5
  'first-activity-after-time-period': FirstActivityAfterLongTimeRule,

  // R-1
  'first-payment': FirstPaymentRule,

  // R-6
  'high-risk-currency': HighRiskCurrencyRule,

  // R-52
  'ip-address-multiple-users': IpAddressMultipleUsersRule,

  // R-88
  'ip-address-unexpected-location': IpAddressUnexpectedLocationRule,

  // R-7
  'low-value-incoming-transactions': LowValueIncomingTransactionsRule,

  // R-8
  'low-value-outgoing-transactions': LowValueOutgoingTransactionsRule,

  // R-10
  'multiple-counterparty-senders-within-time-period':
    MultipleCounterpartySendersWithinTimePeriodRule,

  // R-9
  'multiple-user-senders-within-time-period':
    MultipleUserSendersWithinTimePeriodRule,

  // R-113
  'sender-location-changes-frequency': SenderLocationChangesFrequencyRule,

  // R-24
  'transaction-reference-keyword': TransactionReferenceKeywordRule,

  // R-2
  'transaction-amount': TransactionAmountRule,

  // R-99
  'transaction-amount-user-limit': TransactionAmountUserLimitRule,

  // R-3
  'transaction-new-country': TransactionNewCountryRule,

  // R-4
  'transaction-new-currency': TransactionNewCurrencyRule,

  // R-84, R-85, R-86, R-87, R-89, R-90, R-91, R-92, R-95, R-30
  'transactions-velocity': TransactionsVelocityRule,

  // R-68, R-69, R-109, R-110
  'transactions-volume': TransactionsVolumeRule,

  // R-68, R-69
  'transactions-volume-quantiles': TransactionsVolumeQuantilesRule,

  // R-111
  'user-transaction-pairs': UserTransactionPairsRule,

  // R-117
  'transaction-amount-pattern': TransactionMatchesPatternRule,

  // R-13
  'merchant-receiver-name': MerchantReceiverNameRule,

  // R-22
  'blacklist-card-issued-country': BlacklistCardIssuedCountryRule,

  // R-119
  'high-traffic-between-same-parties': HighTrafficBetweenSameParties,

  // R-118
  'card-holder-name-levensthein-distance': CardHolderNameRule,

  // R-53
  'too-many-users-for-same-card': ToomanyUsersForSameCardRule,

  // TESTING-ONLY RULES
  'tests/test-success-rule': TestSuccessRule,
  'tests/test-failure-rule': TestFailureRule,
  'tests/test-non-hit-rule': TestNonHitRule,
} as unknown as { [key: string]: typeof TransactionRule }
