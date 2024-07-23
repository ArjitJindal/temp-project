import { v4 as uuid } from 'uuid'
import { paymentMethods } from '../data/transactions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { pickRandom, randomInt } from '@/core/seed/samplers/prng'
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
import { randomPaymentAddress } from '@/core/seed/samplers/address'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

function transactionReference(): string {
  return pickRandom([
    'Urgent',
    'Verification',
    'Confirm',
    'Payment',
    'Transfer',
    'Refund',
    'Security',
    'Alert',
    'Prize',
    'Gift',
    'Bonus',
    'Commission',
    'Processing Fee',
    'Tax',
    'Charge',
    'Donation',
    'Investment',
    'Grant',
    'Sweepstake',
    'Lottery',
    'Inheritance',
    'Reward',
    'Payout',
    'Insurance',
    'Compensation',
    'Fees',
    'Subscription',
    'Membership',
    'Access',
    'Service Charge',
    'Update',
    'Renewal',
    'Confirmation',
    'Transaction',
    'Notice',
    'Winning',
    'Earnings',
    'Dividend',
    'Return',
    'Rebate',
    'Delivery',
    'Customs',
    'Clearance',
    'Winnings',
    'Funds',
    'Benefit',
    'Assistance',
    'Support',
    'Guarantee',
    'Protection',
    'Safety',
    'Security',
    'Verification',
    'Authentication',
    'Authorization',
  ])
}

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
      transactionAmount: randomInt(1_00_000),
    },
    originUserId,
    destinationUserId,
    reference: transactionReference(),
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
      ipAddress: [...new Array(4)].map(() => randomInt(256)).join('.'),
    },
    destinationDeviceData: {
      ipAddress: [...new Array(4)].map(() => randomInt(256)).join('.'),
    },
    originPaymentDetails: randomPaymentMethod(),
    hitRules: [],
    executedRules: [],
    status: pickRandom(RULE_ACTIONS),
  }
}

export const randomPaymentMethod = () => {
  return pickRandom(paymentMethods())
}

export function samplePaymentDetails(): PaymentDetails | undefined {
  switch (randomInt(9)) {
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
    cardFingerprint: 'FNGR' + randomInt(),
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
    cardTokenized: false,
    paymentChannel: 'paymentChannel',
    cardType: 'VIRTUAL',
    merchantDetails: {
      id: 'id',
      category: 'category',
      MCC: 'MCC',
      city: 'city',
      country: 'US',
      state: 'state',
      postCode: 'postCode',
    },
  }
}

export function sampleIBANDetails(): IBANDetails {
  return {
    method: 'IBAN' as const,
    BIC: 'AABSDE' + (10 + randomInt(90)).toString(),
    IBAN:
      'DE' +
      [...new Array(2)].map(() => randomInt(9)).join('') +
      [...new Array(8)].map(() => randomInt(9)).join('') +
      [...new Array(10)].map(() => randomInt(9)).join(''),
  }
}

export function sampleGenericBankAccountDetails(): GenericBankAccountDetails {
  return pickRandom<GenericBankAccountDetails>([
    {
      method: 'GENERIC_BANK_ACCOUNT',
      bankName: 'Bank of America',
      bankCode: 'BWEHRHRB',
      name: 'Mark Schagal',
      accountNumber: `${randomInt()}`,
      accountType: 'SAVINGS',
      bankAddress: randomPaymentAddress(),
    },
    {
      method: 'GENERIC_BANK_ACCOUNT',
      bankName: 'Citigroup',
      bankCode: '123123',
      accountNumber: `${randomInt()}`,
      accountType: 'CURRENT',
      name: 'John Dow',
      bankAddress: randomPaymentAddress(),
    },
  ])
}
export function sampleACHDetails(): ACHDetails {
  return {
    method: 'ACH',
    accountNumber: 'ACH' + randomInt(),
    routingNumber: `${randomInt()}`,
  }
}
export function sampleSWIFTDetails(): SWIFTDetails {
  return {
    method: 'SWIFT',
    accountNumber: 'SWIFT' + randomInt(),
    swiftCode: `${randomInt()}`,
  }
}
export function sampleMpesaDetails(): MpesaDetails {
  return {
    method: 'MPESA',
    businessShortCode: `${randomInt()}`,
    transactionType: 'SalaryPayment',
    phoneNumber: `+${randomInt(999999999999)}`,
  }
}
export function sampleUPIDetails(): UPIDetails {
  return {
    method: 'UPI',
    upiID: 'UPI' + randomInt(),
  }
}
export function sampleWalletDetails(): WalletDetails {
  return {
    method: 'WALLET',
    walletType: 'vault',
    walletId: `${randomInt()}`,
  }
}
export function sampleCheckDetails(): CheckDetails {
  return {
    method: 'CHECK',
    checkIdentifier: `${randomInt()}`,
    checkNumber: `${randomInt()}`,
  }
}
