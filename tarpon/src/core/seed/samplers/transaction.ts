import { v4 as uuid } from 'uuid'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import {
  pickRandomDeterministic,
  randomIntDeterministic,
} from '@/core/seed/samplers/prng'
import { CardDetails } from '@/@types/openapi-public/CardDetails'
import { IBANDetails } from '@/@types/openapi-public/IBANDetails'
import { GenericBankAccountDetails } from '@/@types/openapi-public/GenericBankAccountDetails'
import { ACHDetails } from '@/@types/openapi-public/ACHDetails'
import { SWIFTDetails } from '@/@types/openapi-public/SWIFTDetails'
import { MpesaDetails } from '@/@types/openapi-public/MpesaDetails'
import { UPIDetails } from '@/@types/openapi-public/UPIDetails'
import { WalletDetails } from '@/@types/openapi-public/WalletDetails'
import { CheckDetails } from '@/@types/openapi-public/CheckDetails'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { RULE_ACTIONS } from '@/@types/openapi-public-custom/RuleAction'
import { randomAddress } from '@/core/seed/samplers/address'

export function sampleTransaction({
  originUserId,
  destinationUserId,
  originCountry,
  destinationCountry,
}: {
  originUserId?: string
  destinationUserId?: string
  originCountry?: CountryCode
  destinationCountry?: CountryCode
} = {}): InternalTransaction {
  return {
    transactionId: `sample_transaction_${uuid()}`,
    type: 'TRANSFER',
    destinationAmountDetails: {
      country: destinationCountry ?? 'PH',
      transactionCurrency: 'USD',
      transactionAmount: randomIntDeterministic(1_00_000),
    },
    originUserId,
    destinationUserId,
    productType: 'Payment link',
    transactionState: 'CREATED' as const,
    originAmountDetails: {
      country: originCountry ?? ('PH' as const),
      transactionCurrency: 'USD' as const,
      transactionAmount: 50,
    },
    timestamp: new Date().getTime(),
    destinationPaymentDetails: randomPaymentMethod(),
    originDeviceData: {
      ipAddress: [...new Array(4)]
        .map(() => randomIntDeterministic(256))
        .join('.'),
    },
    destinationDeviceData: {
      ipAddress: [...new Array(4)]
        .map(() => randomIntDeterministic(256))
        .join('.'),
    },
    originPaymentDetails: randomPaymentMethod(),
    hitRules: [],
    executedRules: [],
    status: pickRandomDeterministic(RULE_ACTIONS),
  }
}

export const paymentMethods = [...Array(500000)].map(() =>
  samplePaymentDetails()
)

export const randomPaymentMethod = () => {
  return pickRandomDeterministic(paymentMethods)
}

export function samplePaymentDetails() {
  switch (randomIntDeterministic(9)) {
    case 0:
      return sampleCardDetails()
    case 1:
      return sampleIBANDetails()
    case 2:
      return sampleGenericBankAccountDetails()
    case 3:
      return sampleACHDetails()
    case 4:
      return sampleWalletDetails()
    case 5:
      return sampleMpesaDetails()
    case 6:
      return sampleUPIDetails()
    case 7:
      return sampleSWIFTDetails()
    case 8:
      return sampleCheckDetails()
  }
}

export function sampleCardDetails(): CardDetails {
  return {
    method: 'CARD' as const,
    cardFingerprint: 'FNGR' + randomIntDeterministic(),
    cardIssuedCountry: 'RU',
    transactionReferenceField: 'transactionReferenceField',
    nameOnCard: {
      firstName: 'very long firstName here',
      middleName: 'very long middleName here',
      lastName: 'very long lastName here',
    },
    cardExpiry: {
      month: 3,
      year: 2043,
    },
    cardLast4Digits: 'cardLast4Digits',
    cardBrand: 'VISA',
    cardFunding: 'PREPAID',
    cardAuthenticated: true,
    paymentChannel: 'paymentChannel',
    cardType: 'VIRTUAL',
    merchantDetails: {
      id: 'id',
      category: 'category',
      MCC: 'MCC',
      city: 'city',
      country: 'country',
      state: 'state',
      postCode: 'postCode',
    },
  }
}

export function sampleIBANDetails(): IBANDetails {
  return {
    method: 'IBAN' as const,
    BIC: 'AABSDE' + (10 + randomIntDeterministic(90)).toString(),
    IBAN:
      'DE' +
      [...new Array(2)].map(() => randomIntDeterministic(9)).join('') +
      [...new Array(8)].map(() => randomIntDeterministic(9)).join('') +
      [...new Array(10)].map(() => randomIntDeterministic(9)).join(''),
  }
}

export function sampleGenericBankAccountDetails(): GenericBankAccountDetails {
  return pickRandomDeterministic<GenericBankAccountDetails>([
    {
      method: 'GENERIC_BANK_ACCOUNT',
      bankName: 'Bank of America',
      bankCode: 'BWEHRHRB',
      name: 'Mark Schagal',
      accountNumber: `${randomIntDeterministic()}`,
      accountType: 'SAVINGS',
      bankAddress: randomAddress(),
    },
    {
      method: 'GENERIC_BANK_ACCOUNT',
      bankName: 'Citigroup',
      bankCode: '123123',
      accountNumber: `${randomIntDeterministic()}`,
      accountType: 'CURRENT',
      name: 'John Dow',
      bankAddress: randomAddress(),
    },
  ])
}
export function sampleACHDetails(): ACHDetails {
  return {
    method: 'ACH',
    accountNumber: 'ACH' + randomIntDeterministic(),
    routingNumber: `${randomIntDeterministic()}`,
  }
}
export function sampleSWIFTDetails(): SWIFTDetails {
  return {
    method: 'SWIFT',
    accountNumber: 'SWIFT' + randomIntDeterministic(),
    swiftCode: `${randomIntDeterministic()}`,
  }
}
export function sampleMpesaDetails(): MpesaDetails {
  return {
    method: 'MPESA',
    businessShortCode: `${randomIntDeterministic()}`,
    transactionType: 'SalaryPayment',
    phoneNumber: `+${randomIntDeterministic(999999999999)}`,
  }
}
export function sampleUPIDetails(): UPIDetails {
  return {
    method: 'UPI',
    upiID: 'UPI' + randomIntDeterministic(),
  }
}
export function sampleWalletDetails(): WalletDetails {
  return {
    method: 'WALLET',
    walletType: 'vault',
    walletId: `${randomIntDeterministic()}`,
  }
}
export function sampleCheckDetails(): CheckDetails {
  return {
    method: 'CHECK',
    checkIdentifier: `${randomIntDeterministic()}`,
    checkNumber: `${randomIntDeterministic()}`,
  }
}
