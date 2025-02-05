import { v4 as uuid4 } from 'uuid'
import { ManipulateType } from '@flagright/lib/utils/dayjs'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { cloneDeep, uniq } from 'lodash'
import { getDemoDataS3Prefix } from '@lib/constants'
import { ONLY_COUNTRIES } from '@flagright/lib/constants/countries'
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
import {
  companies,
  CompanySeedData,
  names,
} from '@/core/seed/samplers/dictionary'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import { LegalDocument } from '@/@types/openapi-internal/LegalDocument'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { BUSINESS_USER_SEGMENTS } from '@/@types/openapi-internal-custom/BusinessUserSegment'
import { PAYMENT_METHODS } from '@/@types/openapi-internal-custom/PaymentMethod'
import { PaymentDetailsSampler } from '@/core/seed/samplers/transaction'
import {
  phoneNumber,
  AddressWithUsageSampler,
} from '@/core/seed/samplers/address'
import {
  businessRules,
  consumerRules,
  RuleSampler,
  userRules,
} from '@/core/seed/data/rules'
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
import { PersonAttachment } from '@/@types/openapi-internal/PersonAttachment'
import { PaymentDetails } from '@/@types/tranasction/payment-type'

export const emailDomains = ['gmail.com', 'yahoo.com', 'hotmail.com']

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
const addressSampler = new AddressWithUsageSampler()

const comapnyEmails: string[] = companies
  .map((company) => company.contactEmails)
  .flat()
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
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
  })

  getEmail(seed: number, name: ConsumerName) {
    if (seed % 7 === 0) {
      return `${name.firstName.toLowerCase()}${name?.middleName?.toLowerCase()}${name?.lastName?.toLowerCase()}@${this.rng.pickRandom(
        emailDomains
      )}`
    }
    return `${name.firstName.toLowerCase()}${name?.lastName?.toLowerCase()}@${this.rng.pickRandom(
      emailDomains
    )}`
  }

  uploadUserAttachment = async (
    fileName: string,
    fileContent: string,
    tenantId: string
  ) => {
    const s3Key = `${getDemoDataS3Prefix(tenantId)}/${fileName}`
    const command = new PutObjectCommand({
      Bucket: process.env.DOCUMENT_BUCKET,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/pdf',
    })

    await this.s3Client.send(command)
    return {
      s3Key,
      size: Buffer.from(fileContent).length,
    }
  }

  createPdf = (userInfo: {
    userId: string
    userName: string
    attachmentType: string
  }) => {
    const fileName = `${userInfo.userId}-${userInfo.attachmentType}.pdf`
    const pdfHeader = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 5 0 R >>\nstream\n`

    const pdfContent = `BT
/F1 12 Tf
100 700 Td
(User Name: ${userInfo.userName}) Tj
0 -25 Td
(Attachment Type: ${userInfo.attachmentType}) Tj
0 -25 Td
(This is demo document that is uploaded for ${userInfo.userName} for ${userInfo.attachmentType}) Tj
ET\n`

    const pdfFooter = `endstream\nendobj\n5 0 obj\n20\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000010 00000 n\n0000000075 00000 n\n0000000179 00000 n\n0000000223 00000 n\n0000000261 00000 n\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n312\n%%EOF`
    return { fileName, fileContent: pdfHeader + pdfContent + pdfFooter }
  }

  createAndUploadAttachment = async (
    userId: string,
    userName: string,
    attachmentType: string,
    tenantId: string
  ) => {
    const { fileName, fileContent } = this.createPdf({
      userId,
      userName,
      attachmentType,
    })
    const { s3Key, size } = await this.uploadUserAttachment(
      fileName,
      fileContent,
      tenantId
    )
    return { s3Key, size }
  }

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
    const documentType = this.rng.pickRandom(DOCUMENT_TYPES)

    const legalDocument: LegalDocument = {
      documentNumber: Array.from(
        { length: Math.max(8, Math.ceil(this.rng.randomInt(10))) },
        () => letters[Math.floor(this.rng.randomInt(letters.length))]
      ).join(''),
      documentType: documentType,
      documentIssuedDate: timestamp,
      documentExpirationDate: expiryDate,
      documentIssuedCountry: 'US',
      tags: Array.from({ length: Math.ceil(this.rng.randomInt(2)) }, () =>
        this.sampleDocumentTag()
      ),
      nameOnDocument: name,
    }
    return legalDocument
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
      pepCountry: this.rng.pickRandom(
        Object.keys(ONLY_COUNTRIES)
      ) as CountryCode,
      pepRank: this.rng.pickRandom(PEP_RANKS),
    }
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

class ShareHolderSampler extends UserSampler<Promise<Person[]>> {
  companies: CompanySeedData[] = []
  constructor(
    seed: number = Math.random() * Number.MAX_SAFE_INTEGER,
    companies: CompanySeedData[]
  ) {
    super(seed)
    this.companies = companies
  }

  protected getShareHolder = async (
    timestamp: number,
    uploadAttachment: boolean = true,
    domain: string,
    tenantId: string,
    company?: CompanySeedData
  ): Promise<Person> => {
    const shareHolderId = uuid4()
    const name: ConsumerName = this.randomConsumerName()
    const legalDocuments: LegalDocument[] = []
    const attachments: PersonAttachment[] = []

    if (uploadAttachment) {
      for (let i = 0; i < Math.ceil(this.rng.randomInt(4)); i++) {
        const data = this.sampleLegalDocument(name)
        legalDocuments.push(data)
        const attachmentName = `${name.firstName}'s ${data.documentType} ${shareHolderId}`
        const uploadedAttachment = await this.createAndUploadAttachment(
          shareHolderId,
          name.firstName,
          data.documentType,
          tenantId
        )
        const attachment: PersonAttachment = {
          id: uuid4(),
          comment: attachmentName,
          userId: 'auth0|6715dc3e8c86a06594a0375c',
          createdAt: timestamp,
          files: [
            {
              s3Key: uploadedAttachment.s3Key,
              filename: attachmentName,
              size: uploadedAttachment.size,
            },
          ],
        }
        attachments.push(attachment)
      }
    }
    return {
      userId: shareHolderId,
      generalDetails: {
        name,
        countryOfResidence: this.rng.pickRandom(
          Object.keys(ONLY_COUNTRIES)
        ) as CountryCode,
        countryOfNationality: this.rng.pickRandom(
          Object.keys(ONLY_COUNTRIES)
        ) as CountryCode,
        gender: this.rng.pickRandom(['M', 'F', 'NB']),
        dateOfBirth: new Date(this.generateRandomTimestamp()).toDateString(),
      },
      legalDocuments,
      contactDetails: {
        emailIds: [this.getEmail(this.rng.randomInt(1000), name)].concat(
          company?.contactEmails || []
        ),
        faxNumbers: [this.randomPhoneNumber()],
        websites: [domain],
        addresses: addressSampler.getAddress(),
        contactNumbers: [this.randomPhoneNumber()],
      },
      tags: [...Array(Math.ceil(this.rng.randomInt(2)))].map(() => {
        return {
          key: this.rng.pickRandom(tagKeys),
          value: uuid4(),
        }
      }),
      attachments,
    } as Person
  }

  protected async generateSample(
    timestamp: number,
    uploadAttachment: boolean = true,
    domain: string,
    tenantId: string,
    company: CompanySeedData
  ) {
    const numberOfShareHolder = this.rng.randomIntInclusive(1, 2)
    const shareHolders = [
      await this.getShareHolder(
        timestamp,
        uploadAttachment,
        domain,
        tenantId,
        company
      ),
    ]
    while (shareHolders.length < numberOfShareHolder) {
      let c: CompanySeedData | null = null
      while (!c || c == company) {
        c = this.rng.pickRandom(companies)
      }
      shareHolders.push(
        await this.getShareHolder(
          timestamp,
          uploadAttachment,
          domain,
          tenantId,
          company
        )
      )
    }
    return shareHolders
  }
}
class DirectorSampler extends UserSampler<Promise<Person[]>> {
  protected getDirector = async (
    timestamp: number,
    domain: string,
    tenantId: string,
    uploadAttachment: boolean = true
  ): Promise<Person> => {
    const name: ConsumerName = this.randomConsumerName()
    const directorId = uuid4()
    const legalDocuments: LegalDocument[] = []
    const attachments: PersonAttachment[] = []

    if (uploadAttachment) {
      for (let i = 0; i < Math.ceil(this.rng.randomInt(4)); i++) {
        const data = this.sampleLegalDocument(name)
        legalDocuments.push(data)
        const attachmentName = `${name.firstName}'s ${data.documentType} ${directorId}`
        const uploadedAttachment = await this.createAndUploadAttachment(
          directorId,
          name.firstName,
          data.documentType,
          tenantId
        )
        const attachment: PersonAttachment = {
          id: uuid4(),
          comment: attachmentName,
          userId: 'auth0|6715dc3e8c86a06594a0375c',
          createdAt: timestamp,
          files: [
            {
              s3Key: uploadedAttachment.s3Key,
              filename: attachmentName,
              size: uploadedAttachment.size,
            },
          ],
        }
        attachments.push(attachment)
      }
    }
    return {
      userId: directorId,
      legalDocuments,
      contactDetails: {
        emailIds: [this.getEmail(this.rng.randomInt(1000), name)],
        addresses: addressSampler.getAddress(),
        contactNumbers: [this.randomPhoneNumber()],
        faxNumbers: [this.randomPhoneNumber()],
        websites: [domain],
      },
      generalDetails: {
        gender: this.rng.pickRandom(['M', 'F', 'NB']),
        countryOfResidence: this.rng.pickRandom(
          Object.keys(ONLY_COUNTRIES)
        ) as CountryCode,
        countryOfNationality: this.rng.pickRandom(
          Object.keys(ONLY_COUNTRIES)
        ) as CountryCode,
        dateOfBirth: new Date(this.generateRandomTimestamp()).toDateString(),
        name,
      },
      attachments,
    } as Person
  }
  protected async generateSample(
    timestamp: number,
    domain: string,
    tenantId: string,
    uploadAttachment: boolean = true
  ) {
    const numberOfDirectors = this.rng.randomIntInclusive(1, 2)
    const directors: Person[] = []
    while (directors.length < numberOfDirectors) {
      directors.push(
        await this.getDirector(timestamp, domain, tenantId, uploadAttachment)
      )
    }
    return directors
  }
}

export class BusinessUserSampler extends UserSampler<
  Promise<InternalBusinessUser>
> {
  private ruleSampler: RuleSampler
  constructor(seed: number = Math.random() * Number.MAX_SAFE_INTEGER) {
    super(seed)
    this.ruleSampler = new RuleSampler(
      undefined,
      businessRules,
      [2, 3],
      companies.length,
      false
    )
  }

  protected async generateSample(
    tenantId: string,
    uploadAttachment: boolean = true,
    company: CompanySeedData,
    country?: CountryCode
  ): Promise<InternalBusinessUser> {
    const name = company?.name || this.randomName()
    const domain = name.toLowerCase().replace(' ', '').replace('&', '')
    const userId = `U-${this.counter}`
    const timestamp = this.rng.randomTimestamp(
      3600 * 24 * 365 * 1000,
      dayjs().subtract(30, 'day').toDate()
    )

    const tagSampler = new TagSampler()
    const transactionLimitSampler = new ExpectedTransactionLimitSampler()
    const paymentMethodSampler = new PaymentDetailsSampler()

    const hitRules = this.ruleSampler.getSample(undefined, this.counter - 1)
    const executedRules = businessRules.map((r) => ({
      ...r,
      ruleHit: hitRules.some((h) => h.ruleInstanceId === r.ruleInstanceId),
    }))
    const paymentMethod: PaymentDetails[] = []

    for (let i = 0; i < this.rng.randomIntInclusive(0, 8); i++) {
      paymentMethod.push(paymentMethodSampler.getSample())
    }

    const shareHolderSampler = new ShareHolderSampler(undefined, companies)
    const directorSampler = new DirectorSampler()

    const userShareHolders: Person[] = await shareHolderSampler.getSample(
      undefined,
      timestamp,
      uploadAttachment,
      domain,
      tenantId,
      company
    )
    const userDirectors: Person[] = await directorSampler.getSample(
      undefined,
      timestamp,
      domain,
      tenantId,
      uploadAttachment
    )

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
      executedRules: executedRules,
      hitRules: hitRules,
      updatedAt: timestamp + 60 * 60 * 24 * 1000,
      comments: [],
      kycStatusDetails: this.sampleKycStatusDetails(),
      createdTimestamp: timestamp,
      allowedPaymentMethods: this.rng.randomSubset(PAYMENT_METHODS),
      savedPaymentDetails: paymentMethod,
      legalEntity: {
        contactDetails: {
          emailIds: company?.contactEmails || [
            this.getEmail(this.rng.randomInt(1000), {
              firstName: name,
            }),
          ],
          websites: company?.website ? [company.website] : [],
          addresses: addressSampler.getAddress(1),
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
          registrationCountry:
            country ??
            (this.rng.pickRandom(Object.keys(ONLY_COUNTRIES)) as CountryCode),
          tags: [{ key: 'Unit', value: 'S1300' }],
        },
      },
      acquisitionChannel: this.rng.r(5).pickRandom(ACQUISITION_CHANNELS),
      transactionLimits: transactionLimitSampler.getSample(),
      shareHolders: userShareHolders,
      directors: userDirectors,
      linkedEntities: {
        parentUserId: `U-${this.rng.randomInt(200)}`,
      },
    }

    this.assignKrsAndDrsScores(user) // TOOD: make this into a sampler

    return user
  }

  protected randomName(): string {
    return this.rng.pickRandom(names)
  }
}

export class ConsumerUserSampler extends UserSampler<
  Promise<InternalConsumerUser>
> {
  private ruleSampler: RuleSampler
  constructor(
    seed: number = Math.random() * Number.MAX_SAFE_INTEGER,
    counter: number
  ) {
    super(seed, counter)
    this.ruleSampler = new RuleSampler(
      undefined,
      consumerRules,
      [2, 3],
      200,
      false
    )
  }
  protected async generateSample(
    tenantId: string,
    uploadAttachment: boolean = true
  ): Promise<InternalConsumerUser> {
    const userId = `U-${this.counter}`
    const name = this.randomConsumerName()
    const riskLevel = this.rng.pickRandom(RISK_LEVELS)
    const countryOfResidence = this.rng.pickRandom(
      Object.keys(ONLY_COUNTRIES)
    ) as CountryCode
    const countryOfNationality = this.rng.pickRandom(
      Object.keys(ONLY_COUNTRIES)
    ) as CountryCode
    const timestamp = this.rng.randomTimestamp(
      3600 * 24 * 365 * 1000,
      dayjs().subtract(30, 'day').toDate()
    )
    const domain = name.firstName
      .toLowerCase()
      .replace(' ', '')
      .replace('&', '')

    const tagSampler = new TagSampler() // TODO: find a better seed
    const transactionLimitSampler = new ExpectedTransactionLimitSampler()

    const hitRules = this.ruleSampler.getSample(
      undefined,
      this.counter - companies.length - 1
    )
    const executedRules = consumerRules.map((r) => ({
      ...r,
      ruleHit: hitRules.some((h) => h.ruleInstanceId === r.ruleInstanceId),
    }))

    const legalDocuments: LegalDocument[] = []
    const attachments: PersonAttachment[] = []

    if (uploadAttachment) {
      for (let i = 0; i < Math.ceil(this.rng.randomInt(4)); i++) {
        const data = this.sampleLegalDocument(name)
        legalDocuments.push(data)
        const attachmentName = `${name.firstName}'s ${data.documentType} ${userId}`
        const uploadedAttachment = await this.createAndUploadAttachment(
          userId,
          name.firstName,
          data.documentType,
          tenantId
        )
        const attachment: PersonAttachment = {
          id: uuid4(),
          comment: attachmentName,
          userId: 'auth0|6715dc3e8c86a06594a0375c',
          createdAt: timestamp,
          files: [
            {
              s3Key: uploadedAttachment.s3Key,
              filename: attachmentName,
              size: uploadedAttachment.size,
            },
          ],
        }
        attachments.push(attachment)
      }
    }
    const paymentMethodSampler = new PaymentDetailsSampler()

    const paymentMethod: PaymentDetails[] = []

    for (let i = 0; i < this.rng.randomIntInclusive(0, 8); i++) {
      paymentMethod.push(paymentMethodSampler.getSample())
    }

    const user: InternalConsumerUser = {
      type: 'CONSUMER' as const,
      userId,
      acquisitionChannel: this.rng.pickRandom(ACQUISITION_CHANNELS),
      userSegment: this.rng.pickRandom(CONSUMER_USER_SEGMENTS),
      reasonForAccountOpening: [
        this.rng.r(1).pickRandom(['Investment', 'Saving', 'Business', 'Other']),
      ],
      riskLevel,
      sourceOfFunds: [this.rng.r(2).pickRandom(SOURCE_OF_FUNDSS)],
      userStateDetails: this.sampleUserStateDetails(),
      kycStatusDetails: this.sampleKycStatusDetails(),
      legalDocuments,
      attachments,
      userDetails: {
        dateOfBirth: new Date(this.generateRandomTimestamp(18)).toISOString(),
        countryOfResidence: countryOfResidence as CountryCode,
        countryOfNationality: countryOfNationality as CountryCode,
        name,
        gender: this.rng.pickRandom(GENDERS),
        maritalStatus: this.rng.r(6).pickRandom(MARITAL_STATUSS),
        userCategory: this.rng.pickRandom(userCategory),
      },
      contactDetails: {
        emailIds: [
          this.getEmail(this.rng.randomInt(1000), name),
          ...this.rng.randomSubsetOfSize(
            comapnyEmails,
            this.rng.randomIntInclusive(0, 2)
          ),
        ],
        faxNumbers: [this.randomPhoneNumber()],
        websites: [domain],
        addresses: addressSampler.getAddress(1),
        contactNumbers: [this.randomPhoneNumber()],
      },
      occupation: this.rng.r(1).pickRandom(occupation),
      employmentStatus: this.rng.r(2).pickRandom(EMPLOYMENT_STATUSS),
      employmentDetails: {
        employmentSector: this.rng.r(3).pickRandom(employmentSector),
        employerName: this.rng.r(4).pickRandom(employerName),
        businessIndustry: [this.rng.r(5).pickRandom(businessIndustry)],
      },
      executedRules: executedRules,
      hitRules: hitRules,
      transactionLimits: transactionLimitSampler.getSample(),
      savedPaymentDetails: paymentMethod,
      pepStatus: Array.from({ length: Math.ceil(this.rng.randomInt(3)) }).map(
        () => this.randomPepStatus()
      ),
      tags: [
        {
          key: 'crmAccountId',
          value: uuid4(),
        },
        tagSampler.getSample(),
      ],
      updatedAt: timestamp + 60 * 60 * 24 * 1000,
      createdTimestamp: timestamp,
      createdAt: timestamp,
    }

    this.assignKrsAndDrsScores(user)

    return user
  }
}
