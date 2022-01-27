import FirstPaymentrRule from './first-payment'
import TransactionNewCountryRule from './transaction-new-country'

export const rules: { [key: string]: any } = {
  'R-1': FirstPaymentrRule,
  'R-2': TransactionNewCountryRule,
}
