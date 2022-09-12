import { MigrationFn } from 'umzug'
import { deleteUnusedRuleParameter } from '../utils/rule'

async function main() {
  await deleteUnusedRuleParameter(undefined, [
    'transactionType',
    'targetTransactionType',
  ])

  // transactionTypes and paymentMethod are not supported
  await deleteUnusedRuleParameter(
    ['transactions-volume-quantiles'],
    ['transactionTypes', 'paymentMethod']
  )
}

export const up: MigrationFn = async () => {
  await main()
}

export const down: MigrationFn = async () => {
  // skip
}
