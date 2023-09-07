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
const data: ListTypeObject[] = []

const init = () => {
  if (data.length > 0) {
    return
  }
  ;(
    [
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
  ).forEach((subtype, i) => {
    data.push({
      listId: generateChecksum(i).substring(0, 10),
      listType: 'BLACKLIST',
      subtype,
      data: {
        metadata: {
          name: `"${subtype}" list`,
        },
      },
    })
  })
}

export { init, data }
