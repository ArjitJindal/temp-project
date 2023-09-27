import { v4 as uuid4 } from 'uuid'
import { ManipulateType } from 'dayjs'
import { phoneNumber } from '../data/address'
import { sampleCountry } from './countries'
import { sampleString } from './strings'
import { sampleTag } from './tag'
import { KYCStatus } from '@/@types/openapi-internal/KYCStatus'
import { KYCStatusDetails } from '@/@types/openapi-internal/KYCStatusDetails'
import { UserState } from '@/@types/openapi-internal/UserState'
import { UserStateDetails } from '@/@types/openapi-internal/UserStateDetails'
import { pickRandom, randomFloat, randomInt, randomSubset } from '@/utils/prng'
import { USER_STATES } from '@/@types/openapi-internal-custom/UserState'
import { KYC_STATUSS } from '@/@types/openapi-internal-custom/KYCStatus'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { CompanySeedData, randomName } from '@/core/seed/samplers/dictionary'
import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { LegalDocument } from '@/@types/openapi-internal/LegalDocument'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { MerchantMonitoringSourceType } from '@/@types/openapi-internal/MerchantMonitoringSourceType'
import { MERCHANT_MONITORING_SOURCE_TYPES } from '@/@types/openapi-internal-custom/MerchantMonitoringSourceType'
import { BUSINESS_USER_SEGMENTS } from '@/@types/openapi-internal-custom/BusinessUserSegment'
import { PAYMENT_METHODS } from '@/@types/openapi-internal-custom/PaymentMethod'
import { samplePaymentDetails } from '@/core/seed/samplers/transaction'
import { randomAddress } from '@/core/seed/samplers/address'
import { randomUserRules, userRules } from '@/core/seed/data/rules'
import { ACQUISITION_CHANNELS } from '@/@types/openapi-internal-custom/AcquisitionChannel'
import dayjs from '@/utils/dayjs'
import { Person } from '@/@types/openapi-internal/Person'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { CURRENCY_CODES } from '@/@types/openapi-public-custom/CurrencyCode'

export function sampleUserState(seed?: number): UserState {
  return USER_STATES[randomInt(seed, USER_STATES.length)]
}

export function sampleUserStateDetails(seed?: number): UserStateDetails {
  return {
    state: sampleUserState(seed),
  }
}

export function sampleKycStatus(seed?: number): KYCStatus {
  return KYC_STATUSS[randomInt(seed, KYC_STATUSS.length)]
}

export function sampleKycStatusDetails(seed?: number): KYCStatusDetails {
  return {
    status: sampleKycStatus(seed),
  }
}

const emailSet = [...Array(100)].map(
  () => `${randomName().toLowerCase()}@gmail.com`
)

export const randomEmail = () => {
  return pickRandom(emailSet)
}

export const randomPhoneNumber = () => {
  return pickRandom(phoneNumber)
}

const generateRandomTimestamp = () => {
  const minDate = '1947-01-01'
  const maxDate = dayjs().format('YYYY-MM-DD')

  const min = dayjs(minDate).valueOf()
  const max = dayjs(maxDate).valueOf()
  const timestamp = randomFloat() ** 2 * (max - min) + min

  return timestamp
}

const tagKeys = [
  'internalConsumerId',
  'crmAccountId',
  'salesforceAccountId',
  'internalChargebackId',
  'internalDisputeId',
  'internalTransactionId',
  'internalPayoutId',
  'internalRefundId',
]

const getNormalTag = () => {
  return {
    key: pickRandom(tagKeys),
    value: uuid4(),
  }
}

const documentKeys = [
  'isExpired',
  'isFake',
  'isForged',
  'isModified',
  'isNotReadable',
  'isNotValid',
]

const getDocumentTag = () => {
  return {
    key: pickRandom(documentKeys),
    value: ['true', 'false'][Math.floor(Math.random() * 2)],
  }
}

const DOCUMENT_TYPES = [
  'Passport',
  'Driving License',
  'National ID',
  'Residence Permit',
  'INN',
  'Address Proof',
  'Utility Bill',
  'Bank Statement',
  'Other',
]

const timeIntervals = ['day', 'week', 'month', 'year'] as ManipulateType[]

const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'

const legalDocument = (name: ConsumerName): LegalDocument => {
  const timestamp = generateRandomTimestamp()
  const expiryDate = dayjs(timestamp)
    .add(Math.ceil(Math.random() * 10), pickRandom(timeIntervals))
    .valueOf()

  return {
    documentType: pickRandom(DOCUMENT_TYPES),
    documentNumber: Array.from(
      { length: Math.max(8, Math.ceil(Math.random() * 20)) },
      () => letters[Math.ceil(Math.random() * letters.length)]
    ).join(''),
    documentIssuedDate: timestamp,
    documentExpirationDate: expiryDate,
    documentIssuedCountry: 'US',
    tags: [...Array(Math.ceil(Math.random() * 2))].map(() => getDocumentTag()),
    nameOnDocument: name,
  }
}

export function sampleBusinessUser(
  { company, country }: { company?: CompanySeedData; country?: CountryCode },
  seed = 0.1
): { user: InternalBusinessUser } {
  const name = company?.name || randomName()
  const domain = name.toLowerCase().replace(' ', '').replace('&', '')
  const userId = uuid4()
  const paymentMethod = samplePaymentDetails()

  const timestamp = sampleTimestamp(seed)
  const user: InternalBusinessUser = {
    type: 'BUSINESS',
    userId: userId,
    tags: [
      {
        key: 'crmAccountId',
        value: uuid4(),
      },
      sampleTag(),
    ],
    userStateDetails: sampleUserStateDetails(seed),
    executedRules: userRules,
    hitRules: randomUserRules().filter(
      (r) => !r.ruleName.toLowerCase().includes('consumer')
    ),
    updatedAt: timestamp,
    comments: [],
    kycStatusDetails: sampleKycStatusDetails(seed),
    createdTimestamp: timestamp,
    allowedPaymentMethods: randomSubset(PAYMENT_METHODS),
    savedPaymentDetails: paymentMethod ? [paymentMethod] : [],
    legalEntity: {
      contactDetails: {
        emailIds: company?.contactEmails || [randomEmail()],
        websites: company?.website ? [company.website] : [],
        addresses: [randomAddress()],
      },
      companyFinancialDetails: {
        expectedTransactionAmountPerMonth: {
          amountValue: Math.ceil(Math.random() * 10000),
          amountCurrency: pickRandom(CURRENCY_CODES),
        },
        expectedTurnoverPerMonth: {
          amountValue: Math.ceil(Math.random() * 100000),
          amountCurrency: pickRandom(CURRENCY_CODES),
        },
        tags: [{ key: 'Unit', value: 'S1300' }],
      },
      reasonForAccountOpening: [
        pickRandom(['Expansion', 'New Business', 'Savings', 'Other']),
      ],
      companyGeneralDetails: {
        legalName: name,
        businessIndustry: company?.industries || [],
        mainProductsServicesSold: company?.products,
        userSegment: pickRandom(BUSINESS_USER_SEGMENTS),
        userRegistrationStatus:
          Math.ceil(Math.random() * 9 + 1) > 8 ? 'UNREGISTERED' : 'REGISTERED',
      },
      companyRegistrationDetails: {
        taxIdentifier: sampleString(seed),
        legalEntityType: pickRandom([
          'LLC',
          'Sole Proprietorship',
          'Other',
          'Corporation',
        ]),
        registrationIdentifier: sampleString(seed),
        registrationCountry: country ?? sampleCountry(seed),
        tags: [{ key: 'Unit', value: 'S1300' }],
      },
    },
    acquisitionChannel: pickRandom(ACQUISITION_CHANNELS),
    transactionLimits: {
      maximumDailyTransactionLimit: {
        amountValue: Math.ceil(Math.random() * 10000),
        amountCurrency: pickRandom(CURRENCY_CODES),
      },
    },
    shareHolders: Array.from({ length: Math.ceil(Math.random() * 1) }, () => {
      const name: ConsumerName = {
        firstName: randomName(),
        middleName: randomName(),
        lastName: randomName(),
      }

      return {
        generalDetails: {
          name,
          countryOfResidence: country ?? pickRandom(COUNTRY_CODES),
          countryOfNationality: country ?? pickRandom(COUNTRY_CODES),
          gender: pickRandom(['M', 'F', 'NB']),
          dateOfBirth: new Date(generateRandomTimestamp()).toDateString(),
        },
        legalDocuments: Array.from(
          { length: Math.ceil(Math.random() * 4) },
          () => legalDocument(name)
        ),
        contactDetails: {
          emailIds: [name.firstName.toLowerCase() + '@gmail.com'].concat(
            company?.contactEmails || []
          ),
          faxNumbers: [randomPhoneNumber()],
          websites: [domain],
          addresses: [randomAddress()],
          contactNumbers: [randomPhoneNumber()],
        },
        tags: [...Array(Math.ceil(Math.random() * 2))].map(() =>
          getNormalTag()
        ),
      } as Person
    }),
    directors: Array.from({ length: Math.ceil(Math.random() * 2) }, () => {
      const name: ConsumerName = {
        firstName: randomName(),
        middleName: randomName(),
        lastName: randomName(),
      }

      return {
        legalDocuments: Array.from(
          { length: Math.ceil(Math.random() * 4) },
          () => legalDocument(name)
        ),
        contactDetails: {
          emailIds: [name.firstName.toLowerCase() + '@gmail.com'],
          addresses: [randomAddress()],
          contactNumbers: [randomPhoneNumber()],
          faxNumbers: [randomPhoneNumber()],
          websites: [domain],
        },
        generalDetails: {
          gender: pickRandom(['M', 'F', 'NB']),
          countryOfResidence: pickRandom(COUNTRY_CODES),
          countryOfNationality: pickRandom(COUNTRY_CODES),
          dateOfBirth: new Date(generateRandomTimestamp()).toDateString(),
          name,
        },
      } as Person
    }),
  }

  return {
    user,
  }
}

export function merchantMonitoringSummaries(
  id: string,
  c: CompanySeedData
): MerchantMonitoringSummary[] {
  return [0, 1, 2, 3].flatMap((n, i) => {
    const summary = c.summaries[n % 2]
    const sourceType: MerchantMonitoringSourceType =
      MERCHANT_MONITORING_SOURCE_TYPES[n]
    let url: string
    switch (sourceType) {
      case 'COMPANIES_HOUSE':
        url =
          'find-and-update.company-information.service.gov.uk/company/01772433'
        break
      case 'LINKEDIN':
        url = 'www.linkedin.com/company/flagright'
        break
      case 'EXPLORIUM':
        url = 'www.explorium.ai/'
        break
      case 'SCRAPE':
        url = c.website
        break
    }
    const days = 1000 * 60 * 60 * 24
    return [
      new Date().getTime(),
      new Date().getTime() - days * randomInt(i, 365),
      new Date().getTime() - days * randomInt(i, 365),
    ].map((updatedAt) => ({
      source: {
        sourceType,
        sourceValue: url,
      },
      summary,
      userId: id,
      domain: c.website,
      products: c.products,
      employees: c.companySize.toString(),
      industry: c.industries[0],
      location: c.location,
      companyName: c.name,
      revenue: new Intl.NumberFormat('en-US').format(c.annualRevenue),
      updatedAt,
      url,
    }))
  })
}
