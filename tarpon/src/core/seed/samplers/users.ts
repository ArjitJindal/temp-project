import { v4 as uuid4 } from 'uuid'
import { ManipulateType } from '@flagright/lib/utils/dayjs'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { cloneDeep, uniq } from 'lodash'
import {
  getSanctions,
  getSanctionsHits,
  getSanctionsScreeningDetails,
} from '../data/sanctions'
import { TagSampler } from './tag'
import {
  BusinessUserRiskScoreSampler,
  ConsumerUserRiskScoreSampler,
  TransactionRiskScoreSampler,
} from './risk_score_components'
import { BaseSampler } from './base'
import { RandomNumberGenerator } from '@/core/seed/samplers/prng'
import { USER_STATES } from '@/@types/openapi-internal-custom/UserState'
import { KYC_STATUSS } from '@/@types/openapi-internal-custom/KYCStatus'
import { CompanySeedData, names } from '@/core/seed/samplers/dictionary'
import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import { LegalDocument } from '@/@types/openapi-internal/LegalDocument'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { BUSINESS_USER_SEGMENTS } from '@/@types/openapi-internal-custom/BusinessUserSegment'
import { PAYMENT_METHODS } from '@/@types/openapi-internal-custom/PaymentMethod'
import { PaymentDetailsSampler } from '@/core/seed/samplers/transaction'
import { usersAddresses, phoneNumber } from '@/core/seed/samplers/address'
import { userRules } from '@/core/seed/data/rules'
import { ACQUISITION_CHANNELS } from '@/@types/openapi-internal-custom/AcquisitionChannel'
import dayjs from '@/utils/dayjs'
import { Person } from '@/@types/openapi-internal/Person'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { SOURCE_OF_FUNDSS } from '@/@types/openapi-internal-custom/SourceOfFunds'
import {
  BusinessSanctionsSearchSampler,
  ConsumerSanctionsSearchSampler,
} from '@/core/seed/raw-data/sanctions-search'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { RISK_LEVELS } from '@/@types/openapi-internal-custom/RiskLevel'
import { CONSUMER_USER_SEGMENTS } from '@/@types/openapi-internal-custom/ConsumerUserSegment'
import { SAMPLE_CURRENCIES } from '@/core/seed/samplers/currencies'
import { USER_REGISTRATION_STATUSS } from '@/@types/openapi-internal-custom/UserRegistrationStatus'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/services/risk-scoring/repositories/risk-repository'
import { isBusinessUser } from '@/services/rules-engine/utils/user-rule-utils'
import { SanctionsDetails } from '@/@types/openapi-public/SanctionsDetails'
import { PEPStatus } from '@/@types/openapi-internal/PEPStatus'
import { MARITAL_STATUSS } from '@/@types/openapi-public-custom/MaritalStatus'
import { GENDERS } from '@/@types/openapi-public-custom/Gender'
import { EMPLOYMENT_STATUSS } from '@/@types/openapi-internal-custom/EmploymentStatus'
import { PEP_RANKS } from '@/@types/openapi-public-custom/PepRank'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export const emailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com']

const emailRNG = new RandomNumberGenerator(42.1)

const emailSet = [...Array(100)].map(
  () =>
    `${emailRNG.pickRandom(names).toLowerCase()}@${emailRNG.pickRandom(
      emailDomains
    )}`
)

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

const documentKeys = [
  'isExpired',
  'isFake',
  'isForged',
  'isModified',
  'isNotReadable',
  'isNotValid',
]

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

export class ExpectedTransactionLimitSampler extends BaseSampler<any> {
  protected generateSample(): any {
    return {
      ...this.getTransactionLimits('Daily', 10, 5000),
      ...this.getTransactionLimits('Weekly', 5000, 15000),
      ...this.getTransactionLimits('Monthly', 15000, 250000),
      ...this.getTransactionLimits('Quarterly', 250000, 1200000),
      ...this.getTransactionLimits('Yearly', 1200000, 3500000),
      paymentMethodLimits: {
        ...this.getPaymentMethodLimits(),
      },
    }
  }

  private getTransactionLimits(
    timeGranularity: 'Daily' | 'Monthly' | 'Weekly' | 'Quarterly' | 'Yearly',
    minAmount: number,
    maxAmount: number
  ) {
    return {
      [`maximum${timeGranularity}TransactionLimit`]: {
        amountValue: Math.round(
          this.rng.randomFloat() * (maxAmount - minAmount) + minAmount
        ),
        amountCurrency: 'USD',
      },
    }
  }

  private getPaymentMethodLimits() {
    return {
      [this.rng.pickRandom(PAYMENT_METHODS)]: {
        transactionCountLimit: {
          month: this.rng.randomIntInclusive(20, 100),
        },
        transactionAmountLimit: {
          month: {
            amountValue: this.rng.randomInt(100000),
            amountCurrency: 'USD',
          },
        },
        averageTransactionAmountLimit: {
          month: {
            amountValue: this.rng.randomIntInclusive(1000, 3000),
            amountCurrency: 'USD',
          },
        },
      },
    }
  }
}

abstract class UserSampler<T> extends BaseSampler<T> {
  protected randomConsumerName(): {
    firstName: string
    middleName: string
    lastName: string
  } {
    const [firstName, middleName, lastName] = [
      ...new Set(this.rng.randomSubsetOfSize(names, 3)),
    ]
    return {
      firstName,
      middleName,
      lastName,
    }
  }
  protected sampleUserStateDetails() {
    return {
      state: this.rng.pickRandom(USER_STATES),
    }
  }

  protected sampleKycStatusDetails() {
    return {
      status: this.rng.r(1).pickRandom(KYC_STATUSS),
    }
  }

  protected sampleLegalDocument(name: ConsumerName): LegalDocument {
    const timestamp = this.generateRandomTimestamp()
    const expiryDate = dayjs(timestamp)
      .add(
        Math.ceil(this.rng.randomInt(10)),
        this.rng.pickRandom(timeIntervals)
      )
      .valueOf()

    return {
      documentType: this.rng.pickRandom(DOCUMENT_TYPES),
      documentNumber: Array.from(
        { length: Math.max(8, Math.ceil(this.rng.randomInt(10))) },
        () => letters[Math.ceil(this.rng.randomInt(letters.length))]
      ).join(''),
      documentIssuedDate: timestamp,
      documentExpirationDate: expiryDate,
      documentIssuedCountry: 'US',
      tags: [...Array(Math.ceil(this.rng.randomInt(2)))].map(() =>
        this.sampleDocumentTag()
      ),
      nameOnDocument: name,
    }
  }

  protected sampleDocumentTag() {
    return {
      key: this.rng.pickRandom(documentKeys),
      value: ['true', 'false'][Math.floor(this.rng.randomInt(2))],
    }
  }

  protected randomPepStatus(): PEPStatus {
    return {
      isPepHit: Math.random() < 0.5, // TODO: should use the internal PRNG?
      pepCountry: this.rng.pickRandom(COUNTRY_CODES),
      pepRank: this.rng.pickRandom(PEP_RANKS),
    }
  }

  protected randomEmail() {
    return this.rng.pickRandom(emailSet)
  }

  protected randomPhoneNumber() {
    return this.rng.pickRandom(phoneNumber())
  }

  protected sampleUserRules(
    userId: string,
    username: string,
    type: 'CONSUMER' | 'BUSINESS'
  ) {
    // TODO: consider creating a new sampler for UserRules
    const ruleRNG = new RandomNumberGenerator(this.rng.randomInt())
    const randomUserRules = () => {
      // TODO: review this - should make it an array?
      return cloneDeep(ruleRNG.randomSubset(userRules()))
    }
    const hitRules =
      ruleRNG.randomFloat() < 0.2
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
        const sanctionsSearchSampler =
          type === 'CONSUMER'
            ? new ConsumerSanctionsSearchSampler(this.rng.randomInt())
            : new BusinessSanctionsSearchSampler(this.rng.randomInt())

        const { historyItem, hits, screeningDetails } =
          sanctionsSearchSampler.getSample(
            undefined, // seed already assigned
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

  protected assignKrsAndDrsScores(
    user: InternalConsumerUser | InternalBusinessUser
  ) {
    const krsScoreSampler = isBusinessUser(user)
      ? new BusinessUserRiskScoreSampler()
      : new ConsumerUserRiskScoreSampler()
    const arsScoreSampler = new TransactionRiskScoreSampler()

    const krsScoreComponents = krsScoreSampler.getSample(undefined, user)
    const arsScoreComponents = arsScoreSampler.getSample(undefined, user)

    const krsScore =
      krsScoreComponents.reduce((acc, curr) => acc + curr.score, 0) /
      krsScoreComponents.length

    user.krsScore = {
      createdAt: this.sampleTimestamp(),
      krsScore,
      components: krsScoreComponents,
      riskLevel: getRiskLevelFromScore(
        DEFAULT_CLASSIFICATION_SETTINGS,
        krsScore
      ),
      userId: user.userId,
    }

    const drsScoreComponent = arsScoreComponents

    const drsScore =
      drsScoreComponent.reduce((acc, curr) => acc + curr.score, 0) /
      drsScoreComponent.length

    user.drsScore = {
      createdAt: this.sampleTimestamp(),
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
}

export class BusinessUserSampler extends UserSampler<InternalBusinessUser> {
  protected generateSample(
    company?: CompanySeedData,
    country?: CountryCode
  ): InternalBusinessUser {
    const name = company?.name || this.randomName()
    const domain = name.toLowerCase().replace(' ', '').replace('&', '')
    const userId = `U-${this.counter}`
    const timestamp = this.sampleTimestamp(3600 * 365 * 24 * 1000)

    const tagSampler = new TagSampler()
    const transactionLimitSampler = new ExpectedTransactionLimitSampler()
    const paymentMethodSampler = new PaymentDetailsSampler()

    const hitRules = this.sampleUserRules(userId, name, 'BUSINESS')
    const paymentMethod: PaymentDetails[] = []

    for (let i = 0; i < this.rng.randomIntInclusive(0, 8); i++) {
      paymentMethod.push(paymentMethodSampler.getSample())
    }

    const user: InternalBusinessUser = {
      type: 'BUSINESS',
      userId: userId,
      tags: [
        {
          key: 'crmAccountId',
          value: uuid4(),
        },
        tagSampler.getSample(),
      ],
      userStateDetails: this.sampleUserStateDetails(),
      executedRules: userRules(hitRules.map((r) => r.ruleInstanceId)),
      hitRules: hitRules,
      updatedAt: timestamp,
      comments: [],
      kycStatusDetails: this.sampleKycStatusDetails(),
      createdTimestamp: timestamp,
      allowedPaymentMethods: this.rng.randomSubset(PAYMENT_METHODS),
      savedPaymentDetails: paymentMethod,
      legalEntity: {
        contactDetails: {
          emailIds: company?.contactEmails || [this.randomEmail()],
          websites: company?.website ? [company.website] : [],
          addresses: [usersAddresses()[this.counter]],
        },
        companyFinancialDetails: {
          expectedTransactionAmountPerMonth: {
            amountValue: this.rng.randomInt(10000),
            amountCurrency: this.rng.pickRandom(
              SAMPLE_CURRENCIES
            ) as CurrencyCode,
          },
          expectedTurnoverPerMonth: {
            amountValue: this.rng.randomInt(10000),
            amountCurrency: this.rng.pickRandom(
              SAMPLE_CURRENCIES
            ) as CurrencyCode,
          },
          tags: [{ key: 'Unit', value: 'S1300' }],
        },
        reasonForAccountOpening: [
          this.rng.pickRandom([
            'Expansion',
            'New Business',
            'Savings',
            'Other',
          ]),
        ],
        sourceOfFunds: [this.rng.pickRandom(SOURCE_OF_FUNDSS)],
        companyGeneralDetails: {
          legalName: name,
          businessIndustry: company?.industries || [],
          mainProductsServicesSold: company?.products,
          userSegment: this.rng.r(1).pickRandom(BUSINESS_USER_SEGMENTS),
          userRegistrationStatus: this.rng.pickRandom(
            USER_REGISTRATION_STATUSS
          ),
        },
        companyRegistrationDetails: {
          taxIdentifier: this.rng.r(2).randomString(),
          legalEntityType: this.rng
            .r(3)
            .pickRandom(['LLC', 'Sole Proprietorship', 'Other', 'Corporation']),
          registrationIdentifier: this.rng.r(4).randomString(),
          registrationCountry: country ?? this.rng.pickRandom(COUNTRY_CODES),
          tags: [{ key: 'Unit', value: 'S1300' }],
        },
      },
      acquisitionChannel: this.rng.r(5).pickRandom(ACQUISITION_CHANNELS),
      transactionLimits: transactionLimitSampler.getSample(),
      shareHolders: Array.from({ length: 2 }, () => {
        const name: ConsumerName = this.randomConsumerName()

        return {
          userId: uuid4(),
          generalDetails: {
            name,
            countryOfResidence: country ?? this.rng.pickRandom(COUNTRY_CODES),
            countryOfNationality:
              country ?? this.rng.r(2).pickRandom(COUNTRY_CODES),
            gender: this.rng.r(3).pickRandom(['M', 'F', 'NB']),
            dateOfBirth: new Date(
              this.generateRandomTimestamp()
            ).toDateString(),
          },
          legalDocuments: Array.from(
            { length: Math.ceil(this.rng.randomInt(4)) },
            () => this.sampleLegalDocument(name)
          ),
          contactDetails: {
            emailIds: [
              `${name.firstName.toLowerCase()}.${name.middleName?.toLowerCase()}}@${this.rng.pickRandom(
                emailDomains
              )}`,
            ].concat(company?.contactEmails || []),
            faxNumbers: [this.randomPhoneNumber()],
            websites: [domain],
            addresses: [this.rng.pickRandom(usersAddresses())],
            contactNumbers: [this.randomPhoneNumber()],
          },
          tags: [...Array(Math.ceil(this.rng.randomInt(2)))].map(() => {
            return {
              key: this.rng.pickRandom(tagKeys),
              value: uuid4(),
            }
          }),
        } as Person
      }),
      directors: Array.from({ length: 2 }, () => {
        const name: ConsumerName = this.randomConsumerName()

        return {
          userId: uuid4(),
          legalDocuments: Array.from(
            { length: Math.ceil(this.rng.randomInt(4)) },
            () => this.sampleLegalDocument(name)
          ),
          contactDetails: {
            emailIds: [
              name.firstName.toLowerCase() +
                '@' +
                this.rng.pickRandom(emailDomains),
            ],
            addresses: [usersAddresses()[500 + this.counter]],
            contactNumbers: [this.randomPhoneNumber()],
            faxNumbers: [this.randomPhoneNumber()],
            websites: [domain],
          },
          generalDetails: {
            gender: this.rng.pickRandom(['M', 'F', 'NB']),
            countryOfResidence: this.rng.pickRandom(COUNTRY_CODES),
            countryOfNationality: this.rng.pickRandom(COUNTRY_CODES),
            dateOfBirth: new Date(
              this.generateRandomTimestamp()
            ).toDateString(),
            name,
          },
        } as Person
      }),
    }

    this.assignKrsAndDrsScores(user) // TOOD: make this into a sampler

    return user
  }

  protected randomName(): string {
    return this.rng.pickRandom(names)
  }
}

export class ConsumerUserSampler extends UserSampler<InternalConsumerUser> {
  protected generateSample(): InternalConsumerUser {
    const userId = `U-${this.counter}`
    const name = this.randomConsumerName()
    const riskLevel = this.rng.pickRandom(RISK_LEVELS)
    const countryOfResidence = this.rng.pickRandom(COUNTRY_CODES)
    const countryOfNationality = this.rng.r(1).pickRandom(COUNTRY_CODES)
    const timestamp = this.sampleTimestamp(3600 * 24 * 365 * 1000)
    const domain = name.firstName
      .toLowerCase()
      .replace(' ', '')
      .replace('&', '')

    const tagSampler = new TagSampler() // TODO: find a better seed
    const transactionLimitSampler = new ExpectedTransactionLimitSampler()

    const hitRules = this.sampleUserRules(
      userId,
      `${name.firstName} ${name.middleName} ${name.lastName}`,
      'CONSUMER'
    )

    const paymentMethodSampler = new PaymentDetailsSampler()

    const paymentMethod: PaymentDetails[] = []

    for (let i = 0; i < this.rng.randomIntInclusive(0, 8); i++) {
      paymentMethod.push(paymentMethodSampler.getSample())
    }

    const user: InternalConsumerUser = {
      type: 'CONSUMER' as const,
      userId,
      riskLevel,
      acquisitionChannel: this.rng.pickRandom(ACQUISITION_CHANNELS),
      userSegment: this.rng.pickRandom(CONSUMER_USER_SEGMENTS),
      reasonForAccountOpening: [
        this.rng.r(1).pickRandom(['Investment', 'Saving', 'Business', 'Other']),
      ],
      sourceOfFunds: [this.rng.r(2).pickRandom(SOURCE_OF_FUNDSS)],
      userStateDetails: this.sampleUserStateDetails(),
      kycStatusDetails: this.sampleKycStatusDetails(),
      legalDocuments: Array.from(
        { length: Math.ceil(this.rng.randomInt(4)) },
        () => this.sampleLegalDocument(name)
      ),
      userDetails: {
        dateOfBirth: new Date(this.generateRandomTimestamp(18)).toISOString(),
        countryOfResidence,
        countryOfNationality,
        name,
        gender: this.rng.pickRandom(GENDERS),
        maritalStatus: this.rng.r(6).pickRandom(MARITAL_STATUSS),
        userCategory: this.rng.pickRandom(userCategory),
      },
      contactDetails: {
        emailIds: [
          `${name.firstName.toLowerCase()}.${name.middleName?.toLowerCase()}@${this.rng.pickRandom(
            emailDomains
          )}`,
        ],
        faxNumbers: [this.randomPhoneNumber()],
        websites: [domain],
        addresses: [usersAddresses()[this.counter]], // TODO: use address sampler / replace this
        contactNumbers: [this.randomPhoneNumber()],
      },
      occupation: this.rng.r(1).pickRandom(occupation),
      employmentStatus: this.rng.r(2).pickRandom(EMPLOYMENT_STATUSS),
      employmentDetails: {
        employmentSector: this.rng.r(3).pickRandom(employmentSector),
        employerName: this.rng.r(4).pickRandom(employerName),
        businessIndustry: [this.rng.r(5).pickRandom(businessIndustry)],
      },
      pepStatus: Array.from({ length: Math.ceil(this.rng.randomInt(3)) }).map(
        () => this.randomPepStatus()
      ),
      executedRules: userRules(hitRules.map((r) => r.ruleInstanceId)),
      hitRules: hitRules,
      createdTimestamp: timestamp,
      updatedAt: timestamp,
      createdAt: timestamp,
      tags: [
        {
          key: 'crmAccountId',
          value: uuid4(),
        },
        tagSampler.getSample(),
      ],
      transactionLimits: transactionLimitSampler.getSample(),
      savedPaymentDetails: paymentMethod,
    }

    this.assignKrsAndDrsScores(user)

    return user
  }
}
