import { v4 as uuid } from 'uuid'
import { COUNTRY_CODES } from '@flagright/lib/constants'
import { Merchant } from '../raw-data/merchant'
import { BaseSampler } from './base'
import { names } from './dictionary'
import { CRYPTO_CURRENCIES } from './currencies'
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
import { CURRENCY_CODES } from '@/@types/openapi-public-custom/CurrencyCode'
import { WALLET_NETWORKS } from '@/@types/openapi-public-custom/WalletNetwork'
import { RISK_LEVELS } from '@/@types/openapi-public-management-custom/RiskLevel'
import { NPPDetails } from '@/@types/openapi-public/NPPDetails'
import { CashDetails } from '@/@types/openapi-public/CashDetails'

const RANDOM_IPS = [
  { ip: '126.239.220.152', country: 'JP' },
  { ip: '116.219.120.142', country: 'CN' },
  { ip: '3.124.91.35', country: 'DE' },
  { ip: '3.66.58.17', country: 'DE' },
  { ip: '3.70.73.47', country: 'DE' },
  { ip: '3.67.28.78', country: 'DE' },
  { ip: '3.76.95.10', country: 'DE' },
  { ip: '35.156.181.187', country: 'DE' },
  { ip: '18.132.155.115', country: 'GB' },
  { ip: '18.134.212.219', country: 'GB' },
  { ip: '35.177.249.136', country: 'GB' },
  { ip: '13.251.166.15', country: 'SG' },
  { ip: '18.143.88.142', country: 'SG' },
  { ip: '46.137.237.47', country: 'IE' },
  { ip: '18.139.42.183', country: 'SG' },
  { ip: '3.1.188.28', country: 'IN' },
  { ip: '3.1.234.194', country: 'IN' },
  { ip: '13.234.102.242', country: 'IN' },
  { ip: '3.109.243.84', country: 'IN' },
  { ip: '43.205.70.199', country: 'IN' },
  { ip: '35.155.123.185', country: 'US' },
  { ip: '44.237.56.178', country: 'US' },
  { ip: '52.11.98.137', country: 'US' },
  { ip: '3.104.94.7', country: 'AU' },
  { ip: '54.79.45.195', country: 'AU' },
  { ip: '3.28.175.208', country: 'US' },
  { ip: '3.28.224.220', country: 'US' },
  { ip: '51.112.26.119', country: 'GB' },
  { ip: '106.219.120.147', country: 'IN' },
  { ip: '26.1.230.222', country: 'US' },
]

const RISK_INDICATOR_CATEGORIES = [
  'Sanctions',
  'Mixer',
  'Darknet Market',
  'Scam',
  'Ransomware',
  'Stolen Funds',
  'Terrorist Financing',
  'High Risk Exchange',
  'Gambling',
]

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
    const originPaymentDetails =
      originUserPaymentDetails[this.rng.randomInt(11)]

    const destinationPaymentDetails =
      destinationUserPaymentDetails[this.rng.randomInt(11)]

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

export class CryptoTransactionSampler extends BaseSampler<InternalTransaction> {
  protected generateSample({
    originUserId,
    destinationUserId,
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
    const originPaymentDetails = new WalletDetailsSampler().getSample()
    const destinationPaymentDetails = new WalletDetailsSampler().getSample()
    const transactionCurrencyOrigin = this.rng.pickRandom(CRYPTO_CURRENCIES)
    const transactionCurrencyDestination =
      this.rng.pickRandom(CRYPTO_CURRENCIES)
    return {
      transactionId: `sample_transaction_${uuid()}`,
      type: 'TRANSFER',
      destinationAmountDetails: {
        country: this.rng.pickRandom(COUNTRY_CODES) as CountryCode,
        transactionCurrency: transactionCurrencyDestination,
        transactionAmount: this.rng.randomInt(100),
      },
      originUserId,
      destinationUserId,
      reference: this.rng.pickRandom(TRANSACTION_REFERENCES),
      productType: 'Crypto',
      transactionState: 'CREATED' as const,
      originAmountDetails: {
        country: this.rng.pickRandom(COUNTRY_CODES) as CountryCode,
        transactionCurrency: transactionCurrencyOrigin,
        transactionAmount: this.rng.randomInt(100),
      },
      timestamp: new Date().getTime(),
      destinationPaymentDetails: {
        ...destinationPaymentDetails,
        walletBalance: {
          amountValue: this.rng.randomInt(100),
          amountCurrency: transactionCurrencyDestination,
        },
        tags: [
          {
            key: 'address',
            value: `0x${[...Array(40)]
              .map(() => Math.floor(Math.random() * 16).toString(16))
              .join('')}`,
          },
          {
            key: 'Direction',
            value: 'Incoming',
          },
        ],
      },
      originPaymentDetails: {
        ...originPaymentDetails,
        walletBalance: {
          amountValue: this.rng.randomInt(100),
          amountCurrency: transactionCurrencyOrigin,
        },
        tags: [
          {
            key: 'address',
            value: `0x${[...Array(40)]
              .map(() => Math.floor(Math.random() * 16).toString(16))
              .join('')}`,
          },
          {
            key: 'Direction',
            value: 'Outgoing',
          },
        ],
      },
      hitRules: [],
      executedRules: [],
      status: this.rng.pickRandom(RULE_ACTIONS),
      tags: [
        {
          value: this.rng.pickRandom(RISK_LEVELS),
          key: 'Chainanalysis Risk Level',
        },
        ...Array(3)
          .fill(null)
          .map(() => ({
            value: this.rng.pickRandom(RISK_INDICATOR_CATEGORIES),
            key: 'Risk Indicator Category',
          })),
      ],
    }
  }
}

export class PaymentDetailsSampler extends BaseSampler<PaymentDetails> {
  protected generateSample(): PaymentDetails {
    switch (this.rng.randomInt(11)) {
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
      case 9:
        return new NPPDetailsSampler().getSample()
      case 10:
        return new CashDetailsSampler().getSample()
      default:
        return new CardDetailsSampler().getSample()
    }
  }
}

export class CardDetailsSampler extends BaseSampler<CardDetails> {
  generateSample(): CardDetails {
    const merchantDetail = this.rng.pickRandom(Merchant)
    return {
      method: 'CARD' as const,
      cardFingerprint: 'FNGR' + this.rng.randomInt(),
      cardIssuedCountry: this.rng.pickRandom(COUNTRY_CODES) as CountryCode,
      transactionReferenceField: this.rng.pickRandom(TRANSACTION_REFERENCES),
      nameOnCard: {
        firstName: this.rng.pickRandom(names),
        middleName: this.rng.pickRandom(names),
        lastName: this.rng.pickRandom(names),
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
        id: uuid(),
        ...merchantDetail,
      },
    }
  }
}

export class DeviceDataSampler extends BaseSampler<DeviceData> {
  generateSample(): DeviceData {
    const ipInfo = this.rng.pickRandom(RANDOM_IPS)
    return {
      ipAddress: ipInfo.ip,
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
      ipCountry: ipInfo.country as CountryCode,
    }
  }
}

export class IBANDetailsSampler extends BaseSampler<IBANDetails> {
  generateSample(): IBANDetails {
    // TODO: refactor to use a single random number generator
    return {
      name: this.rng.pickRandom(names),
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
        bankName: this.rng.pickRandom([
          'Bank of America',
          'Citigroup',
          'JPMorgan Chase',
          'Wells Fargo',
          'Goldman Sachs',
          'Morgan Stanley',
          'Barclays',
        ]),
        bankCode: `BK${this.rng.randomInt(999999999)}`,
        name: this.rng.pickRandom(names),
        accountNumber: `${this.rng.randomInt()}`,
        accountType: this.rng.pickRandom(['SAVINGS', 'CURRENT']),
        bankAddress: this.rng.pickRandom(paymentAddresses()),
      },
      {
        method: 'GENERIC_BANK_ACCOUNT',
        bankName: this.rng.pickRandom([
          'Bank of America',
          'Citigroup',
          'JPMorgan Chase',
          'Wells Fargo',
          'Goldman Sachs',
          'Morgan Stanley',
          'Barclays',
        ]),
        bankCode: `BK${this.rng.randomInt(999999999)}`,
        accountNumber: `${this.rng.randomInt()}`,
        accountType: 'CURRENT',
        name: this.rng.pickRandom(names),
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
      name: this.rng.pickRandom(names),
      accountBalance: {
        amountValue: this.rng.randomInt(1_00_000),
        amountCurrency: this.rng.pickRandom(CURRENCY_CODES),
      },
      bankName: this.rng.pickRandom([
        'Bank of America',
        'Citigroup',
        'JPMorgan Chase',
        'Wells Fargo',
        'Goldman Sachs',
      ]),
      beneficiaryName: this.rng.pickRandom(names),
      bankAddress: this.rng.pickRandom(paymentAddresses()),
    }
  }
}

export class SWIFTDetailsSampler extends BaseSampler<SWIFTDetails> {
  generateSample(): SWIFTDetails {
    return {
      method: 'SWIFT',
      accountNumber: 'SWIFT' + this.rng.randomInt(),
      swiftCode: `${this.rng.randomInt()}`,
      name: this.rng.pickRandom(names),
      accountBalance: {
        amountValue: this.rng.randomInt(1_00_000),
        amountCurrency: this.rng.pickRandom(CURRENCY_CODES),
      },
      bankName: this.rng.pickRandom(['Bank of America', 'Citigroup']),
      accountType: this.rng.pickRandom(['SAVINGS', 'CURRENT']),
      bankAddress: this.rng.pickRandom(paymentAddresses()),
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
      name: this.rng.pickRandom(names),
      bankProvider: this.rng.pickRandom([
        'HDFC',
        'ICICI',
        'SBI',
        'AXIS',
        'KOTAK',
      ]),
      interfaceProvider: this.rng.pickRandom([
        'HDFC',
        'ICICI',
        'SBI',
        'AXIS',
        'KOTAK',
      ]),
    }
  }
}

export class WalletDetailsSampler extends BaseSampler<WalletDetails> {
  generateSample(): WalletDetails {
    return {
      method: 'WALLET',
      walletType: 'vault',
      walletId: `${this.rng.randomInt()}`,
      name: this.rng.pickRandom(names),
      network: this.rng.pickRandom(WALLET_NETWORKS),
      walletBalance: {
        amountValue: this.rng.randomInt(1_00_000),
        amountCurrency: this.rng.pickRandom(CURRENCY_CODES),
      },
    }
  }
}

export class CheckDetailsSampler extends BaseSampler<CheckDetails> {
  generateSample(): CheckDetails {
    return {
      method: 'CHECK',
      checkIdentifier: `${this.rng.randomInt()}`,
      checkNumber: `${this.rng.randomInt()}`,
      name: this.rng.pickRandom(names),
    }
  }
}

export class CashDetailsSampler extends BaseSampler<CashDetails> {
  generateSample(): CashDetails {
    return {
      method: 'CASH',
      identifier: `${this.rng.randomInt()}`,
    }
  }
}

export class NPPDetailsSampler extends BaseSampler<NPPDetails> {
  generateSample(): NPPDetails {
    return {
      method: 'NPP',
      payId: 'NPP' + this.rng.randomInt(),
      accountNumber: `${this.rng.randomInt()}`,
      isInstant: this.rng.randomBool(),
      bankName: this.rng.pickRandom([
        'Westpac',
        'Australian National Bank',
        'Commonwealth Bank of Australia',
        'National Australia Bank',
        'Bank of Queensland',
        'Bank of Melbourne',
        'Bank of New South Wales',
        'Bank of South Australia',
        'Bank of Tasmania',
        'Bank of Western Australia',
      ]),
      oskoReference: `${this.rng.randomInt()}`,
      endToEndId: `${this.rng.randomInt()}`,
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
      9: new NPPDetailsSampler().getSample(),
      10: new CashDetailsSampler().getSample(),
    }
  }
}
