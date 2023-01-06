import { RuleHitResult } from '../rule'
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
import UserTransactionLimitsRule from './user-transaction-limits'
import TransactionNewCountryRule from './transaction-new-country'
import TransactionNewCurrencyRule from './transaction-new-currency'
import TransactionReferenceKeywordRule from './transaction-reference-keyword'
import TransactionsVelocityRule from './transactions-velocity'
import TransactionsVolumeRule from './transactions-volume'
import UserTransactionPairsRule from './user-transaction-pairs'
import TransactionMatchesPatternRule from './transaction-amount-pattern'
import MerchantReceiverNameRule from './merchant-receiver-name'
import BlacklistCardIssuedCountryRule from './blacklist-card-issued-country'
import CardHolderNameRule from './card-holder-name-levensthein-distance'
import HighTrafficBetweenSameParties from './high-traffic-between-same-parties'
import HighTrafficVolumeBetweenSameUsersParameters from './high-traffic-volume-between-same-users'
import ToomanyUsersForSameCardRule from './too-many-users-for-same-card'
import SameUserUsingTooManyCardsRule from './same-user-using-too-many-cards'
import TransactionsAverageNumberExceededRule from './transactions-average-number-exceeded'
import TransactionsAverageAmountExceededRule from './transactions-average-amount-exceeded'
import TransactionsRoundValuePercentageRule from './transactions-round-value-percentage'
import TooManyTransactionsToHighRiskCountryRule from './too-many-transactions-to-high-risk-country'
import HighUnsuccessfullStateRateRule from './high-unsuccessfull-state-rate'
import TooManyCounterpartyCountryRule from './too-many-counterparty-country'
import TransactionsRoundValueVelocityRule from './transactions-round-value-velocity'
import SamePaymentDetailsRule from './same-payment-details'
import BlacklistPaymentdetailsRule from './blacklist-payment-details'
import TransactionsExceedPastPeriodRule from './transactions-exceed-past-period'
import TestAlwaysHitRule from '@/services/rules-engine/transaction-rules/tests/test-always-hit-rule'
import BlacklistTransactionMatchedValue from '@/services/rules-engine/transaction-rules/blacklist-transaction-related-value'

class TransactionRuleBase extends TransactionRule<unknown> {
  public async computeRule(): Promise<RuleHitResult | undefined> {
    // skip
    return
  }
}

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
  'user-transaction-limits': UserTransactionLimitsRule,
  'transaction-new-country': TransactionNewCountryRule,
  'transaction-new-currency': TransactionNewCurrencyRule,
  'transactions-velocity': TransactionsVelocityRule,
  'transactions-volume': TransactionsVolumeRule,
  'user-transaction-pairs': UserTransactionPairsRule,
  'transaction-amount-pattern': TransactionMatchesPatternRule,
  'merchant-receiver-name': MerchantReceiverNameRule,
  'blacklist-card-issued-country': BlacklistCardIssuedCountryRule,
  'high-traffic-between-same-parties': HighTrafficBetweenSameParties,
  'high-traffic-volume-between-same-users':
    HighTrafficVolumeBetweenSameUsersParameters,
  'card-holder-name-levensthein-distance': CardHolderNameRule,
  'too-many-users-for-same-card': ToomanyUsersForSameCardRule,
  'same-user-using-too-many-cards': SameUserUsingTooManyCardsRule,
  'transactions-round-value-percentage': TransactionsRoundValuePercentageRule,
  'transactions-round-value-velocity': TransactionsRoundValueVelocityRule,
  'transactions-average-number-exceeded': TransactionsAverageNumberExceededRule,
  'transactions-average-amount-exceeded': TransactionsAverageAmountExceededRule,
  'too-many-transactions-to-high-risk-country':
    TooManyTransactionsToHighRiskCountryRule,
  'high-unsuccessfull-state-rate': HighUnsuccessfullStateRateRule,
  'same-payment-details': SamePaymentDetailsRule,
  'too-many-counterparty-country': TooManyCounterpartyCountryRule,
  'blacklist-payment-details': BlacklistPaymentdetailsRule,
  'transactions-exceed-past-period': TransactionsExceedPastPeriodRule,
  'blacklist-transaction-related-value': BlacklistTransactionMatchedValue,

  // TESTING-ONLY RULES
  'tests/test-success-rule': TestSuccessRule,
  'tests/test-failure-rule': TestFailureRule,
  'tests/test-non-hit-rule': TestNonHitRule,
  'tests/test-always-hit-rule': TestAlwaysHitRule,
} as unknown as { [key: string]: typeof TransactionRuleBase }
