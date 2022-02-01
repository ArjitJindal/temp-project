import FirstActivityAfterLongTimeRule from './first-activity-after-time-period'
import FirstPaymentRule from './first-payment'
import HighRiskCurrencyRule from './high-risk-currency'
import LowValueIncomingTransactionsRule from './low-value-incoming-transactions'
import LowValueOutgoingTransactionsRule from './low-value-outgoing-transactions'
import MultipleSendersWithinTimePeriodRule from './multiple-senders-within-time-period'
import { Rule } from './rule'

import TransactionNewCountryRule from './transaction-new-country'
import TransactionNewCurrencyRule from './transaction-new-currency'

export const rules = {
  'R-1': FirstPaymentRule,
  'R-2': TransactionNewCountryRule,
  'R-3': TransactionNewCurrencyRule,
  'R-4': FirstActivityAfterLongTimeRule,
  'R-5': HighRiskCurrencyRule,
  'R-6': LowValueIncomingTransactionsRule,
  'R-7': LowValueOutgoingTransactionsRule,
  'R-8': MultipleSendersWithinTimePeriodRule,
} as unknown as { [key: string]: typeof Rule }
