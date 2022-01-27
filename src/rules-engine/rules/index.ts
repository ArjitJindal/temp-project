import FirstPaymentrRule from './first-payment'
import TransactionNewCountryRule from './transaction-new-country'
import TransactionNewCurrencyRule from './transaction-new-currency'

export const rules: { [key: string]: any } = {
  'R-1': FirstPaymentrRule,
  'R-2': TransactionNewCountryRule,
  'R-3': TransactionNewCurrencyRule,
}
