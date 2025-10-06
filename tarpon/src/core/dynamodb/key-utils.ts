import { envIs } from '@/utils/env'

//Monday, 29 September 2025 18:00:00 GMT
export const PRIMARY_TRANSACTION_SWITCH_TIMESTAMP = 1759168800000
// Wednesday, 23 September 2026 18:00:00 GMT
export const FUTURE_TIMESTAMP_TO_COMPARE = 1790186400000

// Wednesday, 24 September 2025 11:35:00 GMT
export const PRIMARY_TRANSACTION_SWITCH_EU2_TIMESTAMP = 1758713700000

export const BUCKET_IDENTIFIER = '#bucket:'
export const getPrimaryTransactionSwitchTimestamp = () => {
  return envIs('prod') && process.env.REGION === 'eu-2'
    ? PRIMARY_TRANSACTION_SWITCH_EU2_TIMESTAMP
    : PRIMARY_TRANSACTION_SWITCH_TIMESTAMP
}

export const AUXILLARY_TXN_PARTITION_COUNT = 10

export function getBucketNumber(hash: string, partitionsCount: number) {
  const num = BigInt('0x' + hash) // turn into a BigInt
  const bucket = Number(num % BigInt(partitionsCount))
  return bucket + 1 // As we want to make the buckets 1 indexed
}

export function getAllBucketedPartitionKeys(
  baseKey: string,
  partitionsCount: number
) {
  return Array.from(
    { length: partitionsCount },
    (_, b) => `${baseKey}${BUCKET_IDENTIFIER}${b + 1}`
  ).concat(baseKey) // As older transactions can still be saved without a bucket suffix
}

export function sanitiseBucketedKey(key: string | undefined) {
  if (!key) {
    return key
  }
  return key.split('#bucket:')[0]
}
