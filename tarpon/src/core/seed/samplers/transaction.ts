import { v4 as uuid } from 'uuid'
import { COUNTRY_CODES } from '@flagright/lib/constants'
import { BaseSampler } from './base'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
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
import { paymentAddresses } from '@/core/seed/data/address'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { DeviceData } from '@/@types/openapi-internal/DeviceData'

const TRANSACTION_REFERENCES = [
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
]

const OPERATING_SYATEMS = ['iOS', 'Android', 'Windows', 'macOS', 'Linux']
const DEVICE_MAKERS = ['Apple', 'Samsung', 'Google', 'Microsoft', 'Lenovo']
const DEVICE_MODELS = ['iPhone', 'Galaxy', 'Pixel', 'Surface', 'ThinkPad']
const DEVICE_YEARS = ['2020', '2021', '2022', '2023', '2024']
const APP_VERSIONS = ['1.0', '2.0', '3.0', '4.0', '5.0']

export class TransactionSampler extends BaseSampler<InternalTransaction> {
  protected generateSample({
    originUserId,
    destinationUserId,
    originCountry,
    destinationCountry,
    originUserPaymentDetails,
    destinationUserPaymentDetails,
  }: {
    originUserId?: string
    destinationUserId?: string
    originCountry?: CountryCode
    destinationCountry?: CountryCode
    originUserPaymentDetails?: {
      [key: string]: PaymentDetails
    }
    destinationUserPaymentDetails?: {
      [key: string]: PaymentDetails
    }
  }): InternalTransaction {
    // populating if null
    originUserPaymentDetails =
      originUserPaymentDetails ||
      new UserPaymentDetailsSampler(this.rng.randomInt()).getSample()
    destinationUserPaymentDetails =
      destinationUserPaymentDetails ||
      new UserPaymentDetailsSampler(this.rng.randomInt()).getSample()
    // there are 0...8 payment method thus getting a random int to get user patyment details
    const originPaymentDetails = originUserPaymentDetails[this.rng.randomInt(9)]
    const destinationPaymentDetails =
      destinationUserPaymentDetails[this.rng.randomInt(9)]

    return {
      transactionId: `sample_transaction_${uuid()}`,
      type: 'TRANSFER',
      destinationAmountDetails: {
        country: destinationCountry ?? 'PH',
        transactionCurrency: 'USD',
        transactionAmount: this.rng.randomInt(1_00_000),
      },
      originUserId,
      destinationUserId,
      reference: this.rng.pickRandom(TRANSACTION_REFERENCES),
      productType: 'Payment link',
      transactionState: 'CREATED' as const,
      originAmountDetails: {
        country: originCountry ?? ('PH' as const),
        transactionCurrency: 'USD' as const,
        transactionAmount: 50,
      },
      timestamp: new Date().getTime(),
      destinationPaymentDetails: destinationPaymentDetails,
      originDeviceData: new DeviceDataSampler(this.rng.randomInt()).getSample(),
      destinationDeviceData: new DeviceDataSampler(
        this.rng.randomInt()
      ).getSample(),
      originPaymentDetails: originPaymentDetails,
      hitRules: [],
      executedRules: [],
      status: this.rng.pickRandom(RULE_ACTIONS),
    }
  }
}

export class PaymentDetailsSampler extends BaseSampler<PaymentDetails> {
  protected generateSample(): PaymentDetails {
    switch (this.rng.randomInt(9)) {
      case 0:
        return new CardDetailsSampler().getSample()
      case 1:
        return new IBANDetailsSampler().getSample()
      case 2:
        return new GenericBankAccountDetailsSampler().getSample()
      case 3:
        return new ACHDetailsSampler().getSample()
      case 4:
        return new WalletDetailsSampler().getSample()
      case 5:
        return new MpesaDetailsSampler().getSample()
      case 6:
        return new UPIDetailsSampler().getSample()
      case 7:
        return new SWIFTDetailsSampler().getSample()
      case 8:
        return new CheckDetailsSampler().getSample()
      default:
        return new CardDetailsSampler().getSample()
    }
  }
}

export class CardDetailsSampler extends BaseSampler<CardDetails> {
  generateSample(): CardDetails {
    return {
      method: 'CARD' as const,
      cardFingerprint: 'FNGR' + this.rng.randomInt(),
      cardIssuedCountry: this.rng.pickRandom(COUNTRY_CODES) as CountryCode,
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
      cardLast4Digits: this.rng.randomIntInclusive(1000, 9999).toString(),
      cardBrand: this.rng.pickRandom(['VISA', 'MASTERCARD']),
      cardFunding: this.rng.pickRandom(['PREPAID', 'DEBIT', 'CREDIT']),
      cardAuthenticated: this.rng.randomBool(),
      cardTokenized: this.rng.randomBool(),
      paymentChannel: this.rng.pickRandom(['WEB', 'MOBILE', 'POS']),
      cardType: this.rng.pickRandom(['VIRTUAL', 'PHYSICAL']),
      merchantDetails: {
        id: 'id',
        category: this.rng.pickRandom([
          'RETAIL',
          'GROCERY',
          'GAS',
          'ECOMMERCE',
        ]),
        MCC: this.rng.randomIntInclusive(1000, 9999).toString(),
        city: this.rng.pickRandom(['NEW YORK', 'LOS ANGELES', 'CHICAGO']),
        country: this.rng.pickRandom(COUNTRY_CODES) as CountryCode,
        state: this.rng.pickRandom(['NY', 'CA', 'IL', 'ON']),
        postCode: this.rng.randomIntInclusive(10000, 99999).toString(),
      },
    }
  }
}

export class DeviceDataSampler extends BaseSampler<DeviceData> {
  generateSample(): DeviceData {
    return {
      ipAddress: [...new Array(4)].map(() => this.rng.randomInt(256)).join('.'),
      batteryLevel: Number(this.rng.randomFloat(100).toFixed(1)),
      deviceLatitude: Number((this.rng.randomFloat() * 360 - 180).toFixed(5)),
      deviceLongitude: Number((this.rng.randomFloat() * 360 - 180).toFixed(5)),
      deviceIdentifier: uuid(),
      vpnUsed: this.rng.pickRandom([true, false]),
      operatingSystem: this.rng.pickRandom(OPERATING_SYATEMS),
      deviceMaker: this.rng.pickRandom(DEVICE_MAKERS),
      deviceModel: this.rng.pickRandom(DEVICE_MODELS),
      deviceYear: this.rng.pickRandom(DEVICE_YEARS),
      appVersion: this.rng.pickRandom(APP_VERSIONS),
    }
  }
}

export class IBANDetailsSampler extends BaseSampler<IBANDetails> {
  generateSample(): IBANDetails {
    // TODO: refactor to use a single random number generator
    return {
      method: 'IBAN' as const,
      BIC: 'AABSDE' + (10 + this.rng.randomInt(90)).toString(),
      IBAN:
        'DE' +
        [...new Array(2)].map((_, i) => this.rng.r(i).randomInt(9)).join('') +
        [...new Array(8)]
          .map((_, i) => this.rng.r(i + 2).randomInt(9))
          .join('') +
        [...new Array(10)]
          .map((_, i) => this.rng.r(i + 10).randomInt(9))
          .join(''),
    }
  }
}

export class GenericBankAccountDetailsSampler extends BaseSampler<GenericBankAccountDetails> {
  generateSample(): GenericBankAccountDetails {
    return this.rng.pickRandom<GenericBankAccountDetails>([
      {
        method: 'GENERIC_BANK_ACCOUNT',
        bankName: 'Bank of America',
        bankCode: 'BWEHRHRB',
        name: 'Mark Schagal',
        accountNumber: `${this.rng.randomInt()}`,
        accountType: 'SAVINGS',
        bankAddress: this.rng.pickRandom(paymentAddresses()),
      },
      {
        method: 'GENERIC_BANK_ACCOUNT',
        bankName: 'Citigroup',
        bankCode: '123123',
        accountNumber: `${this.rng.randomInt()}`,
        accountType: 'CURRENT',
        name: 'John Dow',
        bankAddress: this.rng.pickRandom(paymentAddresses()),
      },
    ])
  }
}

export class ACHDetailsSampler extends BaseSampler<ACHDetails> {
  generateSample(): ACHDetails {
    return {
      method: 'ACH',
      accountNumber: 'ACH' + this.rng.randomInt(),
      routingNumber: `${this.rng.randomInt()}`,
    }
  }
}

export class SWIFTDetailsSampler extends BaseSampler<SWIFTDetails> {
  generateSample(): SWIFTDetails {
    return {
      method: 'SWIFT',
      accountNumber: 'SWIFT' + this.rng.randomInt(),
      swiftCode: `${this.rng.randomInt()}`,
    }
  }
}

export class MpesaDetailsSampler extends BaseSampler<MpesaDetails> {
  generateSample(): MpesaDetails {
    return {
      method: 'MPESA',
      businessShortCode: `${this.rng.randomInt()}`,
      transactionType: 'SalaryPayment',
      phoneNumber: `+${this.rng.randomInt(999999999999)}`,
    }
  }
}

export class UPIDetailsSampler extends BaseSampler<UPIDetails> {
  generateSample(): UPIDetails {
    return {
      method: 'UPI',
      upiID: 'UPI' + this.rng.randomInt(),
    }
  }
}

export class WalletDetailsSampler extends BaseSampler<WalletDetails> {
  generateSample(): WalletDetails {
    return {
      method: 'WALLET',
      walletType: 'vault',
      walletId: `${this.rng.randomInt()}`,
    }
  }
}

export class CheckDetailsSampler extends BaseSampler<CheckDetails> {
  generateSample(): CheckDetails {
    return {
      method: 'CHECK',
      checkIdentifier: `${this.rng.randomInt()}`,
      checkNumber: `${this.rng.randomInt()}`,
    }
  }
}

export class UserPaymentDetailsSampler extends BaseSampler<{
  [key: string]: PaymentDetails
}> {
  protected generateSample() {
    return {
      0: new CardDetailsSampler().getSample(),
      1: new IBANDetailsSampler().getSample(),
      2: new GenericBankAccountDetailsSampler().getSample(),
      3: new ACHDetailsSampler().getSample(),
      4: new WalletDetailsSampler().getSample(),
      5: new MpesaDetailsSampler().getSample(),
      6: new UPIDetailsSampler().getSample(),
      7: new SWIFTDetailsSampler().getSample(),
      8: new CheckDetailsSampler().getSample(),
    }
  }
}
