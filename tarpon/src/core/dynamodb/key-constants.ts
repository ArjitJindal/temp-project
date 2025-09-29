import { envIs } from '@/utils/env'

//Monday, 29 September 2025 18:00:00 GMT
export const PRIMARY_TRANSACTION_SWITCH_TIMESTAMP = 1759168800000
// Wednesday, 23 September 2026 18:00:00 GMT
export const FUTURE_TIMESTAMP_TO_COMPARE = 1790186400000

// Wednesday, 24 September 2025 11:35:00 GMT
export const PRIMARY_TRANSACTION_SWITCH_EU2_TIMESTAMP = 1758713700000

export const getPrimaryTransactionSwitchTimestamp = () => {
  return envIs('prod') && process.env.REGION === 'eu-2'
    ? PRIMARY_TRANSACTION_SWITCH_EU2_TIMESTAMP
    : PRIMARY_TRANSACTION_SWITCH_TIMESTAMP
}
