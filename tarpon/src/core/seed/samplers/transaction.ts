import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { pickRandom, prng, randomInt } from '@/utils/prng'
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

export function sampleTransaction(
  {
    originUserId,
    destinationUserId,
    originCountry,
    destinationCountry,
  }: {
    originUserId?: string
    destinationUserId?: string
    originCountry?: CountryCode
    destinationCountry?: CountryCode
  } = {},
  seed = 0.1
): InternalTransaction {
  const rnd = prng(seed)

  return {
    transactionId: `sample_transaction_${randomInt(seed)}`,
    type: 'TRANSFER',
    destinationAmountDetails: {
      country: destinationCountry ?? 'PH',
      transactionCurrency: 'USD',
      transactionAmount: 50,
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
    deviceData: {
      ipAddress: [...new Array(4)].map(() => randomInt(rnd(), 256)).join('.'),
    },
    originDeviceData: {
      ipAddress: [...new Array(4)].map(() => randomInt(rnd(), 256)).join('.'),
    },
    destinationDeviceData: {
      ipAddress: [...new Array(4)].map(() => randomInt(rnd(), 256)).join('.'),
    },
    originPaymentDetails: randomPaymentMethod(),
    hitRules: [],
    executedRules: [],
    status: pickRandom(RULE_ACTIONS),
  }
}

export const paymentMethods = [...Array(100000)].map((i) =>
  samplePaymentDetails(i)
)

export const randomPaymentMethod = () => {
  return pickRandom(paymentMethods)
}

export function samplePaymentDetails(seed?: number) {
  switch (randomInt(seed, 9)) {
    case 0:
      return sampleCardDetails(seed)
    case 1:
      return sampleIBANDetails(seed)
    case 2:
      return sampleGenericBankAccountDetails(seed)
    case 3:
      return sampleACHDetails(seed)
    case 4:
      return sampleWalletDetails(seed)
    case 5:
      return sampleMpesaDetails(seed)
    case 6:
      return sampleUPIDetails(seed)
    case 7:
      return sampleSWIFTDetails(seed)
    case 8:
      return sampleCheckDetails(seed)
  }
}

export function sampleCardDetails(seed?: number): CardDetails {
  const rnd = prng(seed)
  return {
    method: 'CARD' as const,
    cardFingerprint: 'FNGR' + randomInt(rnd()),
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

export function sampleIBANDetails(seed?: number): IBANDetails {
  const rnd = prng(seed)
  return {
    method: 'IBAN' as const,
    BIC: 'AABSDE' + (10 + randomInt(rnd(), 90)).toString(),
    IBAN:
      'DE' +
      [...new Array(2)].map(() => randomInt(rnd(), 9)).join('') +
      [...new Array(8)].map(() => randomInt(rnd(), 9)).join('') +
      [...new Array(10)].map(() => randomInt(rnd(), 9)).join(''),
  }
}

export function sampleGenericBankAccountDetails(
  seed?: number
): GenericBankAccountDetails {
  const rnd = prng(seed)

  return pickRandom<GenericBankAccountDetails>(
    [
      {
        method: 'GENERIC_BANK_ACCOUNT',
        bankName: 'Bank of America',
        bankCode: 'BWEHRHRB',
        name: 'Mark Schagal',
        accountNumber: `${randomInt(rnd())}`,
        accountType: 'SAVINGS',
        bankAddress: randomAddress(),
      },
      {
        method: 'GENERIC_BANK_ACCOUNT',
        bankName: 'Citigroup',
        bankCode: '123123',
        accountNumber: `${randomInt(rnd())}`,
        accountType: 'CURRENT',
        name: 'John Dow',
        bankAddress: randomAddress(),
      },
    ],
    rnd()
  )
}
export function sampleACHDetails(seed?: number): ACHDetails {
  const rnd = prng(seed)
  return {
    method: 'ACH',
    accountNumber: 'ACH' + randomInt(rnd()),
    routingNumber: `${randomInt(rnd())}`,
  }
}
export function sampleSWIFTDetails(seed?: number): SWIFTDetails {
  const rnd = prng(seed)
  return {
    method: 'SWIFT',
    accountNumber: 'SWIFT' + randomInt(rnd()),
    swiftCode: `${randomInt(rnd())}`,
  }
}
export function sampleMpesaDetails(seed?: number): MpesaDetails {
  const rnd = prng(seed)
  return {
    method: 'MPESA',
    businessShortCode: `${randomInt(rnd())}`,
    transactionType: 'SalaryPayment',
    phoneNumber: `+${randomInt(rnd(), 999999999999)}`,
  }
}
export function sampleUPIDetails(seed?: number): UPIDetails {
  const rnd = prng(seed)
  return {
    method: 'UPI',
    upiID: 'UPI' + randomInt(rnd()),
  }
}
export function sampleWalletDetails(seed?: number): WalletDetails {
  const rnd = prng(seed)
  return {
    method: 'WALLET',
    walletType: 'vault',
    walletId: `${randomInt(rnd())}`,
  }
}
export function sampleCheckDetails(seed?: number): CheckDetails {
  const rnd = prng(seed)
  return {
    method: 'CHECK',
    checkIdentifier: `${randomInt(rnd())}`,
    checkNumber: `${randomInt(rnd())}`,
  }
}
