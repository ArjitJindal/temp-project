import { deleteUnusedRuleFilter } from '../utils/rule'

export const up = async () => {
  await deleteUnusedRuleFilter([
    'paymentMethods',
    'walletType',
    'transactionCardIssuedCountries',
    'paymentChannels',
  ])
}
export const down = async () => {
  // skip
}
