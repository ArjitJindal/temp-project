import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { prng, randomInt } from '@/utils/prng'
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

export function sampleTransaction(
  {
    originUserId,
    originCountry,
    destinationCountry,
  }: {
    originUserId?: string
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
    productType: 'Payment link',
    transactionState: 'CREATED' as const,
    originAmountDetails: {
      country: originCountry ?? ('PH' as const),
      transactionCurrency: 'USD' as const,
      transactionAmount: 50,
    },
    timestamp: new Date().getTime(),
    destinationPaymentDetails: samplePaymentDetails(seed + 0.1),
    deviceData: {
      ipAddress: [...new Array(4)].map(() => randomInt(rnd(), 256)).join('.'),
    },
    originPaymentDetails: samplePaymentDetails(seed),
    hitRules: [],
    executedRules: [],
    status: 'ALLOW' as const,
  }
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
  return {
    method: 'GENERIC_BANK_ACCOUNT',
    accountNumber: 'BNK' + randomInt(rnd()),
  }
}
export function sampleACHDetails(seed?: number): ACHDetails {
  const rnd = prng(seed)
  return {
    method: 'ACH',
    accountNumber: 'ACH' + randomInt(rnd()),
  }
}
export function sampleSWIFTDetails(seed?: number): SWIFTDetails {
  const rnd = prng(seed)
  return {
    method: 'SWIFT',
    accountNumber: 'SWIFT' + randomInt(rnd()),
  }
}
export function sampleMpesaDetails(_seed?: number): MpesaDetails {
  return {
    method: 'MPESA',
    businessShortCode: '123',
    transactionType: 'SalaryPayment',
    phoneNumber: '+4912345682999',
  }
}
export function sampleUPIDetails(seed?: number): UPIDetails {
  const rnd = prng(seed)
  return {
    method: 'UPI',
    upiID: 'UPI' + randomInt(rnd()),
  }
}
export function sampleWalletDetails(_seed?: number): WalletDetails {
  return {
    method: 'WALLET',
    walletType: 'vault',
  }
}
export function sampleCheckDetails(_seed?: number): CheckDetails {
  return {
    method: 'CHECK',
  }
}
