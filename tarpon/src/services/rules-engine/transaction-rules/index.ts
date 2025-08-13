import { RuleHitResult } from '../rule'
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
import TransactionNewCountryRule from './transaction-new-country'
import TransactionNewCurrencyRule from './transaction-new-currency'
import TransactionReferenceKeywordRule from './transaction-reference-keyword'
import TransactionsVelocityRule from './transactions-velocity'
import TransactionsVolumeRule from './transactions-volume'
import TransactionMatchesPatternRule from './transaction-amount-pattern'
import MerchantReceiverNameRule from './merchant-receiver-name'
import BlacklistCardIssuedCountryRule from './blacklist-card-issued-country'
import PaymentMethodNameNameRule from './payment-method-name-levensthein-distance'
import HighTrafficBetweenSameParties from './high-traffic-between-same-parties'
import HighTrafficVolumeBetweenSameUsersParameters from './high-traffic-volume-between-same-users'
import TooManyUsersForSamePaymentIdentifierRule from './too-many-users-for-same-payment-identifier'
import TransactionsAverageNumberExceededRule from './transactions-average-number-exceeded'
import TransactionAverageAmountExceededRule from './transactions-average-amount-exceeded'
import TransactionAverageDailyAmountExceededRule from './transactions-average-daily-amount-exceeded'
import TransactionsRoundValuePercentageRule from './transactions-round-value-percentage'
import TooManyTransactionsToHighRiskCountryRule from './too-many-transactions-to-high-risk-country'
import HighUnsuccessfullStateRateRule from './high-unsuccessfull-state-rate'
import TooManyCounterpartyCountryRule from './too-many-counterparty-country'
import TransactionsRoundValueVelocityRule from './transactions-round-value-velocity'
import SamePaymentDetailsRule from './same-payment-details'
import BlacklistPaymentdetailsRule from './blacklist-payment-details'
import TransactionsExceedPastPeriodRule from './transactions-exceed-past-period'
import TransactionsOutflowInflowVolumeRule from './transactions-outflow-inflow-volume'
import { SanctionsCounterPartyRule } from './sanctions-counterparty'
import { TransactionVolumeExceedsTwoPeriodsRule } from './total-transactions-volume-exceeds'
import HighRiskCountryRule from './high-risk-countries'
import UsingTooManyBanksToMakePaymentsRule from './using-too-many-banks-to-make-payments'
import { HighRiskIpAddressCountries } from './high-risk-ip-address-countries'
import SameUserUsingTooManyPaymentIdentifiersRule from './same-user-using-too-many-payment-identifiers'
import { BankAccountHolderNameChangeRule } from './bank-account-holder-name-change'
import { PaymentDetailsScreeningRule } from './payment-details-screening'
import TransactionAnomalyRule from './transaction-anomaly'
import TransactionsFrequencyAnomalyRule from './transactions-frequency-anomaly'
import AverageTransactionValueSpikeRule from './average-transaction-value-spike'
import RoundAmountAnomalyRule from './round-amount-anomaly'
import BankNameChangeRule from '@/services/rules-engine/transaction-rules/bank-name-change'
import BlacklistTransactionMatchedValue from '@/services/rules-engine/transaction-rules/blacklist-transaction-related-value'
import TestAlwaysHitRule from '@/services/rules-engine/transaction-rules/tests/test-always-hit-rule'
export class TransactionRuleBase extends TransactionRule<unknown> {
  public async computeRule(): Promise<RuleHitResult | undefined> {
    // skip
    return
  }
}

export const _TRANSACTION_RULES = {
  'using-too-many-banks-to-make-payments': UsingTooManyBanksToMakePaymentsRule,
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
  'transaction-new-country': TransactionNewCountryRule,
  'transaction-new-currency': TransactionNewCurrencyRule,
  'transactions-velocity': TransactionsVelocityRule,
  'transactions-volume': TransactionsVolumeRule,
  'transaction-amount-pattern': TransactionMatchesPatternRule,
  'merchant-receiver-name': MerchantReceiverNameRule,
  'blacklist-card-issued-country': BlacklistCardIssuedCountryRule,
  'high-traffic-between-same-parties': HighTrafficBetweenSameParties,
  'high-traffic-volume-between-same-users':
    HighTrafficVolumeBetweenSameUsersParameters,
  'too-many-users-for-same-payment-identifier':
    TooManyUsersForSamePaymentIdentifierRule,
  'payment-method-name-levensthein-distance': PaymentMethodNameNameRule,
  'same-user-using-too-many-payment-identifiers':
    SameUserUsingTooManyPaymentIdentifiersRule,
  'transactions-round-value-percentage': TransactionsRoundValuePercentageRule,
  'transactions-round-value-velocity': TransactionsRoundValueVelocityRule,
  'transactions-average-number-exceeded': TransactionsAverageNumberExceededRule,
  'transactions-average-amount-exceeded': TransactionAverageAmountExceededRule,
  'transactions-average-daily-amount-exceeded':
    TransactionAverageDailyAmountExceededRule,
  'too-many-transactions-to-high-risk-country':
    TooManyTransactionsToHighRiskCountryRule,
  'high-unsuccessfull-state-rate': HighUnsuccessfullStateRateRule,
  'same-payment-details': SamePaymentDetailsRule,
  'too-many-counterparty-country': TooManyCounterpartyCountryRule,
  'blacklist-payment-details': BlacklistPaymentdetailsRule,
  'transactions-exceed-past-period': TransactionsExceedPastPeriodRule,
  'blacklist-transaction-related-value': BlacklistTransactionMatchedValue,
  'transactions-outflow-inflow-volume': TransactionsOutflowInflowVolumeRule,
  'sanctions-counterparty': SanctionsCounterPartyRule,
  'total-transactions-volume-exceeds': TransactionVolumeExceedsTwoPeriodsRule,
  'high-risk-countries': HighRiskCountryRule,
  'high-risk-ip-address-countries': HighRiskIpAddressCountries,
  'bank-name-change': BankNameChangeRule,
  'bank-account-holder-name-change': BankAccountHolderNameChangeRule,
  'payment-details-screening': PaymentDetailsScreeningRule,
  // Stddev anomaly rules
  'transaction-anomaly': TransactionAnomalyRule,
  'transactions-frequency-anomaly': TransactionsFrequencyAnomalyRule,
  'average-transaction-value-spike': AverageTransactionValueSpikeRule,
  'round-amount-anomaly': RoundAmountAnomalyRule,

  // TESTING-ONLY RULES
  'tests/test-success-rule': TestSuccessRule,
  'tests/test-failure-rule': TestFailureRule,
  'tests/test-non-hit-rule': TestNonHitRule,
  'tests/test-always-hit-rule': TestAlwaysHitRule,
} as const

export type TransactionRuleImplementationName = keyof typeof _TRANSACTION_RULES

export const TRANSACTION_RULES = _TRANSACTION_RULES as unknown as {
  [key: string]: typeof TransactionRuleBase
}
