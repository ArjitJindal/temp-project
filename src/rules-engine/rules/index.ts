import FirstActivityAfterLongTimeRule from './first-activity-after-time-period'
import FirstPaymentrRule from './first-payment'
import { Rule } from './rule'

import TransactionNewCountryRule from './transaction-new-country'
import TransactionNewCurrencyRule from './transaction-new-currency'

export const rules = {
  'R-1': FirstPaymentrRule,
  'R-2': TransactionNewCountryRule,
  'R-3': TransactionNewCurrencyRule,
  'R-4': FirstActivityAfterLongTimeRule,
} as unknown as { [key: string]: typeof Rule }
