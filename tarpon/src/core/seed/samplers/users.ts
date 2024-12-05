import { v4 as uuid4 } from 'uuid'
import { ManipulateType } from '@flagright/lib/utils/dayjs'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { uniq } from 'lodash'
import {
  getSanctions,
  getSanctionsHits,
  getSanctionsScreeningDetails,
} from '../data/sanctions'
import { sampleCountry } from './countries'
import { sampleString } from './strings'
import { sampleTag } from './tag'
import {
  sampleBusinessUserRiskScoreComponents,
  sampleConsumerUserRiskScoreComponents,
  sampleTransactionRiskScoreComponents,
} from './risk_score_components'
import { KYCStatus } from '@/@types/openapi-internal/KYCStatus'
import { KYCStatusDetails } from '@/@types/openapi-internal/KYCStatusDetails'
import { UserState } from '@/@types/openapi-internal/UserState'
import { UserStateDetails } from '@/@types/openapi-internal/UserStateDetails'
import {
  getRandomIntInclusive,
  pickRandom,
  randomFloat,
  randomInt,
  randomSubset,
} from '@/core/seed/samplers/prng'
import { USER_STATES } from '@/@types/openapi-internal-custom/UserState'
import { KYC_STATUSS } from '@/@types/openapi-internal-custom/KYCStatus'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import {
  CompanySeedData,
  randomConsumerName,
  randomName,
} from '@/core/seed/samplers/dictionary'
import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { LegalDocument } from '@/@types/openapi-internal/LegalDocument'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { BUSINESS_USER_SEGMENTS } from '@/@types/openapi-internal-custom/BusinessUserSegment'
import { PAYMENT_METHODS } from '@/@types/openapi-internal-custom/PaymentMethod'
import { samplePaymentDetails } from '@/core/seed/samplers/transaction'
import { phoneNumber, randomAddress } from '@/core/seed/samplers/address'
import { randomUserRules, userRules } from '@/core/seed/data/rules'
import { ACQUISITION_CHANNELS } from '@/@types/openapi-internal-custom/AcquisitionChannel'
import dayjs from '@/utils/dayjs'
import { Person } from '@/@types/openapi-internal/Person'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { SOURCE_OF_FUNDSS } from '@/@types/openapi-internal-custom/SourceOfFunds'
import {
  businessSanctionsSearch,
  consumerSanctionsSearch,
} from '@/core/seed/raw-data/sanctions-search'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { RISK_LEVELS } from '@/@types/openapi-internal-custom/RiskLevel'
import { CONSUMER_USER_SEGMENTS } from '@/@types/openapi-internal-custom/ConsumerUserSegment'
import { sampleCurrency } from '@/core/seed/samplers/currencies'
import { USER_REGISTRATION_STATUSS } from '@/@types/openapi-internal-custom/UserRegistrationStatus'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/services/risk-scoring/repositories/risk-repository'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'
import { SanctionsDetails } from '@/@types/openapi-public/SanctionsDetails'
import { PEPStatus } from '@/@types/openapi-internal/PEPStatus'
import { MARITAL_STATUSS } from '@/@types/openapi-public-custom/MaritalStatus'
import { GENDERS } from '@/@types/openapi-public-custom/Gender'
import { EMPLOYMENT_STATUSS } from '@/@types/openapi-internal-custom/EmploymentStatus'
import { PEP_RANKS } from '@/@types/openapi-public-custom/PepRank'

export function sampleUserState(): UserState {
  return pickRandom(USER_STATES)
}

export function sampleUserStateDetails(): UserStateDetails {
  return {
    state: sampleUserState(),
  }
}

export function sampleKycStatus(): KYCStatus {
  return pickRandom(KYC_STATUSS)
}

export function sampleKycStatusDetails(): KYCStatusDetails {
  return {
    status: sampleKycStatus(),
  }
}

export const emailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com']

const emailSet = [...Array(100)].map(
  () => `${randomName().toLowerCase()}@${pickRandom(emailDomains)}`
)

export const randomEmail = () => {
  return pickRandom(emailSet)
}

export const randomPhoneNumber = () => {
  return pickRandom(phoneNumber())
}

const generateRandomTimestamp = (yearDifference: number = 0) => {
  const minDate = '1947-01-01'
  const maxDate = dayjs().subtract(yearDifference, 'year').format('YYYY-MM-DD')

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

const userCategory = [
  'Individual',
  'Business Owner',
  'Freelancer',
  'Investor',
  'Student',
  'Retiree',
]

const occupation = [
  'Software Developer',
  'Data Analyst',
  'Marketing Manager',
  'Consultant',
  'Teacher',
  'Doctor',
  'Sales Executive',
]

const employmentSector = [
  'Information Technology',
  'Healthcare',
  'Education',
  'Finance',
  'Manufacturing',
  'Retail',
  'Government',
]

const employerName = [
  'TechCorp Solutions',
  'GreenMed Health Services',
  'EduBright Institute',
  'Zenith Bank',
  'Urban Retailers',
  'State Innovations',
]

const businessIndustry = [
  'E-commerce',
  'Real Estate',
  'Pharmaceuticals',
  'Hospitality',
  'Construction',
  'Media & Entertainment',
  'Automotive Industry',
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
    value: ['true', 'false'][Math.floor(randomInt(2))],
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
    .add(Math.ceil(randomInt(10)), pickRandom(timeIntervals))
    .valueOf()

  return {
    documentType: pickRandom(DOCUMENT_TYPES),
    documentNumber: Array.from(
      { length: Math.max(8, Math.ceil(randomInt(10))) },
      () => letters[Math.ceil(randomInt(letters.length))]
    ).join(''),
    documentIssuedDate: timestamp,
    documentExpirationDate: expiryDate,
    documentIssuedCountry: 'US',
    tags: [...Array(Math.ceil(randomInt(2)))].map(() => getDocumentTag()),
    nameOnDocument: name,
  }
}

const randomPepStatus = (): PEPStatus => {
  return {
    isPepHit: Math.random() < 0.5,
    pepCountry: pickRandom(COUNTRY_CODES),
    pepRank: pickRandom(PEP_RANKS),
  }
}

export function getUserRules(
  userId: string,
  username: string,
  type: 'CONSUMER' | 'BUSINESS'
) {
  const hitRules =
    randomFloat() < 0.2
      ? randomUserRules().filter(
          (r) =>
            r.ruleName.toLowerCase().includes(type.toLowerCase()) ||
            r.ruleName.toLowerCase().includes('bank')
        )
      : []

  return hitRules.map((r) => {
    if (!r.ruleHitMeta) {
      return r
    }

    const entityTypes = [
      'CONSUMER_NAME',
      'NAME_ON_CARD',
      'PAYMENT_NAME',
      'PAYMENT_BENEFICIARY_NAME',
    ] as const
    const entity =
      r.ruleId === 'R-32'
        ? 'BANK'
        : r.ruleId === 'R-169'
        ? 'EXTERNAL_USER'
        : 'USER'
    for (const entityType of entityTypes) {
      // Seed a sanctions response
      const { historyItem, hits, screeningDetails } =
        type === 'CONSUMER'
          ? consumerSanctionsSearch(
              username,
              userId,
              r.ruleInstanceId,
              undefined,
              entity
            )
          : businessSanctionsSearch(
              username,
              userId,
              r.ruleInstanceId,
              undefined,
              entity
            )
      getSanctions().push(historyItem)
      getSanctionsHits().push(...hits)
      getSanctionsScreeningDetails().push(screeningDetails)
      const sanctionsDetails: SanctionsDetails = {
        name: username,
        searchId: historyItem._id,
        entityType: type === 'CONSUMER' ? entityType : 'LEGAL_NAME',
        sanctionHitIds: uniq(hits.map((hit) => hit.sanctionsHitId)),
      }

      r.ruleHitMeta.sanctionsDetails = [
        ...(r.ruleHitMeta.sanctionsDetails ?? []),
        sanctionsDetails,
      ]
    }

    return r
  })
}

let userCounter = 1

export function sampleConsumerUser() {
  const userId = `U-${userCounter}`
  userCounter++
  const name = randomConsumerName()
  const riskLevel = pickRandom(RISK_LEVELS)
  const countryOfResidence = pickRandom(COUNTRY_CODES)
  const countryOfNationality = pickRandom(COUNTRY_CODES)
  const timestamp = sampleTimestamp(3600 * 24 * 365 * 1000)
  const domain = name.firstName.toLowerCase().replace(' ', '').replace('&', '')
  const hitRules = getUserRules(
    userId,
    `${name.firstName} ${name.middleName} ${name.lastName}`,
    'CONSUMER'
  )
  const user: InternalConsumerUser = {
    type: 'CONSUMER' as const,
    userId,
    riskLevel,
    acquisitionChannel: pickRandom(ACQUISITION_CHANNELS),
    userSegment: pickRandom(CONSUMER_USER_SEGMENTS),
    reasonForAccountOpening: [
      pickRandom(['Investment', 'Saving', 'Business', 'Other']),
    ],
    sourceOfFunds: [pickRandom(SOURCE_OF_FUNDSS)],
    userStateDetails: sampleUserStateDetails(),
    kycStatusDetails: sampleKycStatusDetails(),
    legalDocuments: Array.from({ length: Math.ceil(randomInt(4)) }, () =>
      legalDocument(name)
    ),
    userDetails: {
      dateOfBirth: new Date(generateRandomTimestamp(18)).toISOString(),
      countryOfResidence,
      countryOfNationality,
      name,
      gender: pickRandom(GENDERS),
      maritalStatus: pickRandom(MARITAL_STATUSS),
      userCategory: pickRandom(userCategory),
    },
    contactDetails: {
      emailIds: [
        `${name.firstName.toLowerCase()}.${name.middleName?.toLowerCase()}@${pickRandom(
          emailDomains
        )}`,
      ],
      faxNumbers: [randomPhoneNumber()],
      websites: [domain],
      addresses: [randomAddress()],
      contactNumbers: [randomPhoneNumber()],
    },
    occupation: pickRandom(occupation),
    employmentStatus: pickRandom(EMPLOYMENT_STATUSS),
    employmentDetails: {
      employmentSector: pickRandom(employmentSector),
      employerName: pickRandom(employerName),
      businessIndustry: [pickRandom(businessIndustry)],
    },
    pepStatus: Array.from({ length: Math.ceil(randomInt(3)) }).map(() =>
      randomPepStatus()
    ),
    executedRules: userRules(hitRules.map((r) => r.ruleInstanceId)),
    hitRules,
    createdTimestamp: timestamp,
    updatedAt: timestamp,
    createdAt: timestamp,
    tags: [
      {
        key: 'crmAccountId',
        value: uuid4(),
      },
      sampleTag(),
    ],
    transactionLimits: sampleExpectedTransactionLimit(),
  }

  assignKrsAndDrsScores(user)

  return user
}

function assignKrsAndDrsScores(
  user: InternalConsumerUser | InternalBusinessUser
) {
  const krsScoreComponents = isBusinessUser(user)
    ? sampleBusinessUserRiskScoreComponents(user as InternalBusinessUser)
    : sampleConsumerUserRiskScoreComponents(user as InternalConsumerUser)

  const arsScoreComponents = sampleTransactionRiskScoreComponents()

  const krsScore =
    krsScoreComponents.reduce((acc, curr) => acc + curr.score, 0) /
    krsScoreComponents.length

  user.krsScore = {
    createdAt: sampleTimestamp(),
    krsScore,
    components: krsScoreComponents,
    riskLevel: getRiskLevelFromScore(DEFAULT_CLASSIFICATION_SETTINGS, krsScore),
    userId: user.userId,
  }

  const drsScoreComponent = pickRandom([
    krsScoreComponents,
    arsScoreComponents,
    arsScoreComponents,
    arsScoreComponents,
  ])

  const drsScore =
    drsScoreComponent.reduce((acc, curr) => acc + curr.score, 0) /
    drsScoreComponent.length

  user.drsScore = {
    createdAt: sampleTimestamp(),
    drsScore,
    components: drsScoreComponent,
    derivedRiskLevel: getRiskLevelFromScore(
      DEFAULT_CLASSIFICATION_SETTINGS,
      drsScore
    ),
    userId: user.userId,
    isUpdatable: true,
  }
}

export function sampleBusinessUser({
  company,
  country,
}: {
  company?: CompanySeedData
  country?: CountryCode
}): { user: InternalBusinessUser } {
  const name = company?.name || randomName()
  const domain = name.toLowerCase().replace(' ', '').replace('&', '')
  const userId = `U-${userCounter}`
  userCounter++
  const paymentMethod = samplePaymentDetails()

  const timestamp = sampleTimestamp(3600 * 365 * 24 * 1000)
  const hitRules = getUserRules(userId, name, 'BUSINESS')
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
    userStateDetails: sampleUserStateDetails(),
    executedRules: userRules(hitRules.map((r) => r.ruleInstanceId)),
    hitRules,
    updatedAt: timestamp,
    comments: [],
    kycStatusDetails: sampleKycStatusDetails(),
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
          amountValue: randomInt(10000),
          amountCurrency: sampleCurrency(),
        },
        expectedTurnoverPerMonth: {
          amountValue: randomInt(10000),
          amountCurrency: sampleCurrency(),
        },
        tags: [{ key: 'Unit', value: 'S1300' }],
      },
      reasonForAccountOpening: [
        pickRandom(['Expansion', 'New Business', 'Savings', 'Other']),
      ],
      sourceOfFunds: [pickRandom(SOURCE_OF_FUNDSS)],
      companyGeneralDetails: {
        legalName: name,
        businessIndustry: company?.industries || [],
        mainProductsServicesSold: company?.products,
        userSegment: pickRandom(BUSINESS_USER_SEGMENTS),
        userRegistrationStatus: pickRandom(USER_REGISTRATION_STATUSS),
      },
      companyRegistrationDetails: {
        taxIdentifier: sampleString(),
        legalEntityType: pickRandom([
          'LLC',
          'Sole Proprietorship',
          'Other',
          'Corporation',
        ]),
        registrationIdentifier: sampleString(),
        registrationCountry: country ?? sampleCountry(),
        tags: [{ key: 'Unit', value: 'S1300' }],
      },
    },
    acquisitionChannel: pickRandom(ACQUISITION_CHANNELS),
    transactionLimits: sampleExpectedTransactionLimit(),
    shareHolders: Array.from({ length: 2 }, () => {
      const name: ConsumerName = randomConsumerName()

      return {
        userId: uuid4(),
        generalDetails: {
          name,
          countryOfResidence: country ?? pickRandom(COUNTRY_CODES),
          countryOfNationality: country ?? pickRandom(COUNTRY_CODES),
          gender: pickRandom(['M', 'F', 'NB']),
          dateOfBirth: new Date(generateRandomTimestamp()).toDateString(),
        },
        legalDocuments: Array.from({ length: Math.ceil(randomInt(4)) }, () =>
          legalDocument(name)
        ),
        contactDetails: {
          emailIds: [
            `${name.firstName.toLowerCase()}.${name.middleName?.toLowerCase()}}@${pickRandom(
              emailDomains
            )}`,
          ].concat(company?.contactEmails || []),
          faxNumbers: [randomPhoneNumber()],
          websites: [domain],
          addresses: [randomAddress()],
          contactNumbers: [randomPhoneNumber()],
        },
        tags: [...Array(Math.ceil(randomInt(2)))].map(() => getNormalTag()),
      } as Person
    }),
    directors: Array.from({ length: 2 }, () => {
      const name: ConsumerName = randomConsumerName()

      return {
        userId: uuid4(),
        legalDocuments: Array.from({ length: Math.ceil(randomInt(4)) }, () =>
          legalDocument(name)
        ),
        contactDetails: {
          emailIds: [
            name.firstName.toLowerCase() + '@' + pickRandom(emailDomains),
          ],
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

  assignKrsAndDrsScores(user)

  return {
    user,
  }
}

const sampleExpectedTransactionLimit = () => {
  return {
    ...getTransactionLimits('Daily', 10, 5000),
    ...getTransactionLimits('Weekly', 5000, 15000),
    ...getTransactionLimits('Monthly', 15000, 250000),
    ...getTransactionLimits('Quarterly', 250000, 1200000),
    ...getTransactionLimits('Yearly', 1200000, 3500000),
    paymentMethodLimits: {
      ...getPaymentMethodLimits(),
    },
  }
}

const getTransactionLimits = (
  timeGranularity: 'Daily' | 'Monthly' | 'Weekly' | 'Quarterly' | 'Yearly',
  minAmount: number,
  maxAmount: number
) => {
  return {
    [`maximum${timeGranularity}TransactionLimit`]: {
      amountValue: getRandomIntInclusive(minAmount, maxAmount),
      amountCurrency: 'USD',
    },
  }
}

const getPaymentMethodLimits = () => {
  return {
    [pickRandom(PAYMENT_METHODS)]: {
      transactionCountLimit: {
        month: getRandomIntInclusive(20, 100),
      },
      transactionAmountLimit: {
        month: {
          amountValue: randomInt(100000),
          amountCurrency: 'USD',
        },
      },
      averageTransactionAmountLimit: {
        month: {
          amountValue: getRandomIntInclusive(1000, 3000),
          amountCurrency: 'USD',
        },
      },
    },
  }
}
