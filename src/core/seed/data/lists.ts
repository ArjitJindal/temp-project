import { ListType } from '@/@types/openapi-public/ListType'
import { ListSubtype } from '@/@types/openapi-public/ListSubtype'
import { ListData } from '@/@types/openapi-public/ListData'

let data: {
  listType: ListType
  subtype: ListSubtype
  data: ListData
}[] = []

const init = () => {
  if (data.length > 0) {
    return
  }
  data = (
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
  ).map((subtype) => ({
    listType: 'BLACKLIST',
    subtype,
    data: {
      metadata: {
        name: `"${subtype}" list`,
      },
    },
  }))
}

export { init, data }
