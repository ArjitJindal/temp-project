import memoize from 'lodash/memoize'
import { ListType } from '@/@types/openapi-public/ListType'
import { ListSubtype } from '@/@types/openapi-public/ListSubtype'
import { ListData } from '@/@types/openapi-public/ListData'
import { generateChecksum } from '@/utils/object'

type ListTypeObject = {
  listType: ListType
  listId: string
  subtype: ListSubtype
  data: ListData
}

const data: () => ListTypeObject[] = memoize(() => {
  const blacklistSubtypes = [
    'USER_ID',
    'CARD_FINGERPRINT_NUMBER',
    'IBAN_NUMBER',
    'BANK_ACCOUNT_NUMBER',
    'ACH_ACCOUNT_NUMBER',
    'SWIFT_ACCOUNT_NUMBER',
    'BIC',
    'BANK_SWIFT_CODE',
    'UPI_IDENTIFYING_NUMBER',
    'IP_ADDRESS',
  ] as const

  const whitelistSubtypes = [
    'USER_ID',
    'CARD_FINGERPRINT_NUMBER',
    'IBAN_NUMBER',
    'BANK_ACCOUNT_NUMBER',
    'IP_ADDRESS',
  ] as const

  const blacklists = blacklistSubtypes.map((subtype, i) => {
    return {
      listId: generateChecksum(i).substring(0, 10),
      listType: 'BLACKLIST' as const,
      subtype,
      data: {
        metadata: {
          name: `"${subtype}" blacklist`,
        },
      },
    }
  })

  const whitelists = whitelistSubtypes.map((subtype, i) => {
    return {
      listId: generateChecksum(i + 100).substring(0, 10), // Use different range to avoid ID conflicts
      listType: 'WHITELIST' as const,
      subtype,
      data: {
        metadata: {
          name: `"${subtype}" whitelist`,
        },
      },
    }
  })

  return [...blacklists, ...whitelists]
})

export { data }
