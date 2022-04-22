import ConsecutiveTransactionsameTypeRule from './consecutive-transactions-same-type'
import FirstActivityAfterLongTimeRule from './first-activity-after-time-period'
import FirstPaymentRule from './first-payment'
import HighRiskCurrencyRule from './high-risk-currency'
import IpAddressMultipleUsersRule from './ip-address-multiple-users'
import LowValueIncomingTransactionsRule from './low-value-incoming-transactions'
import LowValueOutgoingTransactionsRule from './low-value-outgoing-transactions'
import MultipleCounterpartySendersWithinTimePeriodRule from './multiple-counterparty-senders-within-time-period'
import MultipleUserSendersWithinTimePeriodRule from './multiple-user-senders-within-time-period'
import { Rule } from './rule'
import TransactionAmountRule from './transaction-amount'
import TransactionNewCountryRule from './transaction-new-country'
import TransactionNewCurrencyRule from './transaction-new-currency'
import TransactionsVelocityRule from './transactions-velocity'
import UserTransactionPairsRule from './user-transaction-pairs'

export const rules = {
  'consecutive-transactions-same-type': ConsecutiveTransactionsameTypeRule,
  'first-activity-after-time-period': FirstActivityAfterLongTimeRule,
  'first-payment': FirstPaymentRule,
  'high-risk-currency': HighRiskCurrencyRule,
  'ip-address-multiple-users': IpAddressMultipleUsersRule,
  'low-value-incoming-transactions': LowValueIncomingTransactionsRule,
  'low-value-outgoing-transactions': LowValueOutgoingTransactionsRule,
  'multiple-counterparty-senders-within-time-period':
    MultipleCounterpartySendersWithinTimePeriodRule,
  'multiple-user-senders-within-time-period':
    MultipleUserSendersWithinTimePeriodRule,

  // TODO: re-enable the rule after we move fast-geoip to lambda layer
  // 'sender-location-changes-frequency': SenderLocationChangesFrequencyRule,

  'transaction-amount': TransactionAmountRule,
  'transaction-new-country': TransactionNewCountryRule,
  'transaction-new-currency': TransactionNewCurrencyRule,
  'transactions-velocity': TransactionsVelocityRule,
  'user-transaction-pairs': UserTransactionPairsRule,
} as unknown as { [key: string]: typeof Rule }
