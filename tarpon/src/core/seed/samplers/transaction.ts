import { v4 as uuid } from 'uuid'
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

export class TransactionSampler extends BaseSampler<InternalTransaction> {
  protected generateSample({
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
    // use different seeds for origin and destination to generate different payment details
    const origSeed = this.rng.randomInt() + 1
    const destSeed = this.rng.randomInt() - 1
    const originPaymentDetails = new PaymentDetailsSampler(origSeed).getSample()
    const destinationPaymentDetails = new PaymentDetailsSampler(
      destSeed
    ).getSample()

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
      originDeviceData: {
        ipAddress: [...new Array(4)]
          .map((_, i) => this.rng.r(i).randomInt(256))
          .join('.'),
      },
      destinationDeviceData: {
        ipAddress: [...new Array(4)]
          .map((_, i) => this.rng.r(i + 4).randomInt(256))
          .join('.'),
      },
      originPaymentDetails: originPaymentDetails,
      hitRules: [],
      executedRules: [],
      status: this.rng.pickRandom(RULE_ACTIONS),
    }
  }
}

export class PaymentDetailsSampler extends BaseSampler<
  PaymentDetails | undefined
> {
  protected generateSample(): PaymentDetails | undefined {
    const seed = this.rng.randomNumber()
    switch (this.rng.randomInt(9)) {
      case 0:
        return new CardDetailsSampler(seed).getSample()
      case 1:
        return new IBANDetailsSampler(seed).getSample()
      case 2:
        return new GenericBankAccountDetailsSampler(seed).getSample()
      case 3:
        return new ACHDetailsSampler(seed).getSample()
      case 4:
        return new WalletDetailsSampler(seed).getSample()
      case 5:
        return new MpesaDetailsSampler(seed).getSample()
      case 6:
        return new UPIDetailsSampler(seed).getSample()
      case 7:
        return new SWIFTDetailsSampler(seed).getSample()
      case 8:
        return new CheckDetailsSampler(seed).getSample()
    }
  }
}

export class CardDetailsSampler extends BaseSampler<CardDetails> {
  generateSample(): CardDetails {
    return {
      method: 'CARD' as const,
      cardFingerprint: 'FNGR' + this.rng.randomInt(),
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
