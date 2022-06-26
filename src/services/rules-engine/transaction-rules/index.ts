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
import MerchantReceiverNameRuleParameters from './merchant-receiver-name'
import BlacklistCardIssuedCountryRule from './blacklist-card-issued-country'

export const TRANSACTION_RULES = {
  'card-issued-country': CardIssuedCountryRule,
  'consecutive-transactions-same-type': ConsecutiveTransactionsameTypeRule,
  'first-activity-after-time-period': FirstActivityAfterLongTimeRule,
  'first-payment': FirstPaymentRule,
  'high-risk-currency': HighRiskCurrencyRule,
  'ip-address-multiple-users': IpAddressMultipleUsersRule,
  'ip-address-unexpected-location': IpAddressUnexpectedLocationRule,
  'low-value-incoming-transactions': LowValueIncomingTransactionsRule,
  'low-value-outgoing-transactions': LowValueOutgoingTransactionsRule,
  'multiple-counterparty-senders-within-time-period':
    MultipleCounterpartySendersWithinTimePeriodRule,
  'multiple-user-senders-within-time-period':
    MultipleUserSendersWithinTimePeriodRule,
  'sender-location-changes-frequency': SenderLocationChangesFrequencyRule,
  'transaction-reference-keyword': TransactionReferenceKeywordRule,
  'transaction-amount': TransactionAmountRule,
  'transaction-amount-user-limit': TransactionAmountUserLimitRule,
  'transaction-new-country': TransactionNewCountryRule,
  'transaction-new-currency': TransactionNewCurrencyRule,
  'transactions-velocity': TransactionsVelocityRule,
  'transactions-volume': TransactionsVolumeRule,
  'transactions-volume-quantiles': TransactionsVolumeQuantilesRule,
  'user-transaction-pairs': UserTransactionPairsRule,
  'transaction-amount-pattern': TransactionMatchesPatternRule,
  'merchant-receiver-name': MerchantReceiverNameRuleParameters,
  'blacklist-card-issued-country': BlacklistCardIssuedCountryRule,

  // For testing only
  'tests/test-success-rule': TestSuccessRule,
  'tests/test-failure-rule': TestFailureRule,
  'tests/test-non-hit-rule': TestNonHitRule,
} as unknown as { [key: string]: typeof TransactionRule }
