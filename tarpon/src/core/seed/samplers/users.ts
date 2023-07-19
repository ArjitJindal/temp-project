import { uuid4 } from '@sentry/utils'
import { sampleCountry } from './countries'
import { sampleString } from './strings'
import { sampleBusinessUserRiskScoreComponents } from './risk_score_components'
import { KYCStatus } from '@/@types/openapi-internal/KYCStatus'
import { KYCStatusDetails } from '@/@types/openapi-internal/KYCStatusDetails'
import { UserState } from '@/@types/openapi-internal/UserState'
import { UserStateDetails } from '@/@types/openapi-internal/UserStateDetails'
import { pickRandom, randomFloat, randomInt } from '@/utils/prng'
import { USER_STATES } from '@/@types/openapi-internal-custom/UserState'
import { KYC_STATUSS } from '@/@types/openapi-internal-custom/KYCStatus'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { CompanySeedData, randomName } from '@/core/seed/samplers/dictionary'
import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { LegalDocument } from '@/@types/openapi-internal/LegalDocument'
import { Tag } from '@/@types/openapi-internal/Tag'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { MerchantMonitoringSummary } from '@/@types/openapi-internal/MerchantMonitoringSummary'
import { MerchantMonitoringSourceType } from '@/@types/openapi-internal/MerchantMonitoringSourceType'
import { MERCHANT_MONITORING_SOURCE_TYPES } from '@/@types/openapi-internal-custom/MerchantMonitoringSourceType'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'

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

const generateRandomTimestamp = () => {
  let rand = Math.random() * 100000

  rand = Math.floor(rand)

  return Date.now() - rand
}

const tag1: Tag = {
  key: 'tag_1',
  value: 'tag_1',
}

const documentTag1: Tag = {
  key: 'tag_1',
  value: 'Doc Tag #1',
}

const documentTag2: Tag = {
  key: 'tag_2',
  value: 'Doc Tag #2',
}

const legalDocument1: LegalDocument = {
  documentType: 'Passport',
  documentNumber: '781939182',
  documentIssuedDate: generateRandomTimestamp(),
  documentExpirationDate: Date.now() + 3600000 * 24 * 365 * 4,
  documentIssuedCountry: 'US',
  tags: [documentTag1, documentTag2],
  nameOnDocument: {
    firstName: 'Share',
    middleName: 'Holder',
    lastName: 'Number-One',
  },
}

const legalDocument2: LegalDocument = {
  documentType: 'INN',
  documentNumber: 'HDPNE233',
  documentIssuedDate: generateRandomTimestamp(),
  documentIssuedCountry: 'US',
  tags: [documentTag1, documentTag2],
  nameOnDocument: {
    firstName: randomName(),
    middleName: randomName(),
    lastName: randomName(),
  },
}

export function sampleBusinessUser(
  { company, country }: { company?: CompanySeedData; country?: CountryCode },
  seed = 0.1
): { user: InternalBusinessUser; drsScore: DrsScore; krsScore: KrsScore } {
  const name = company?.name || randomName()
  const domain = name.toLowerCase().replace(' ', '').replace('&', '')
  const drsScore = Number((randomFloat() * 100).toFixed(2))
  const krsScore = Number((randomFloat() * 100).toFixed(2))
  const userId = uuid4()
  return {
    user: {
      type: 'BUSINESS',
      userId: userId,
      drsScore: {
        drsScore: drsScore,
        createdAt: Date.now(),
        isUpdatable: true,
      },
      userStateDetails: sampleUserStateDetails(seed),
      krsScore: {
        krsScore: krsScore,
        createdAt: sampleTimestamp(seed),
      },
      comments: [
        {
          body: 'User is behaving suspiciously',
        },
      ],
      kycStatusDetails: sampleKycStatusDetails(seed),
      createdTimestamp: sampleTimestamp(seed),
      legalEntity: {
        contactDetails: {
          emailIds: company?.contactEmails || [],
          websites: company?.website ? [company.website] : [],
        },
        companyFinancialDetails: {
          expectedTransactionAmountPerMonth: {
            amountValue: Math.floor(Math.random() * 10000),
            amountCurrency: 'USD',
          },
          expectedTurnoverPerMonth: {
            amountValue: Math.floor(Math.random() * 100000),
            amountCurrency: 'USD',
          },
        },
        companyGeneralDetails: {
          legalName: name,
          businessIndustry: company?.industries || [],
          userRegistrationStatus:
            Math.floor(Math.random() * 9 + 1) > 8
              ? 'UNREGISTERED'
              : 'REGISTERED',
        },
        companyRegistrationDetails: {
          registrationIdentifier: sampleString(seed),
          registrationCountry: country ?? sampleCountry(seed),
        },
      },
      transactionLimits: {
        maximumDailyTransactionLimit: {
          amountValue: Math.floor(Math.random() * 10000),
          amountCurrency: 'USD',
        },
      },
      shareHolders: [
        {
          generalDetails: {
            name: {
              firstName: randomName(),
              middleName: randomName(),
              lastName: randomName(),
            },
            countryOfResidence: country ?? pickRandom(COUNTRY_CODES, seed),
            countryOfNationality: country ?? pickRandom(COUNTRY_CODES, seed),
          },
          legalDocuments: [legalDocument1, legalDocument2],
          contactDetails: {
            emailIds: company?.contactEmails || [],
            contactNumbers: ['+4287878787', '+1 656 332134'],
            faxNumbers: ['+999999'],
            websites: [domain],
            addresses: [
              {
                addressLines: ['Times Square 12B', 'App. 11'],
                postcode: '88173',
                city: 'New York',
                state: 'New York',
                country: 'USA',
                tags: [tag1],
              },
              {
                addressLines: ['Baker St. 55'],
                postcode: '777',
                city: 'London',
                country: 'UK',
              },
            ],
          },
          tags: [tag1],
        },
        {
          generalDetails: {
            name: {
              firstName: randomName(),
              middleName: randomName(),
              lastName: randomName(),
            },
          },
        },
      ],
      directors: [
        {
          legalDocuments: [legalDocument1, legalDocument2],
          contactDetails: {
            emailIds: ['some@email.com'],
            addresses: [
              {
                addressLines: ['Times Square 12B', 'App. 11'],
                postcode: '88173',
                city: 'New York',
                state: 'New York',
                country: 'USA',
                tags: [tag1],
              },
            ],
          },
          generalDetails: {
            gender: 'M',
            countryOfResidence: 'AF',
            dateOfBirth: new Date().toISOString(),
            name: {
              firstName: randomName(),
              middleName: randomName(),
              lastName: randomName(),
            },
          },
        },
      ],
    },
    drsScore: {
      createdAt: sampleTimestamp(),
      userId: userId,
      derivedRiskLevel: pickRandom(RISK_LEVEL1S),
      drsScore: drsScore,
      isUpdatable: true,
    },
    krsScore: {
      createdAt: sampleTimestamp(),
      krsScore: krsScore,
      userId: userId,
      riskLevel: pickRandom(RISK_LEVEL1S),
      components: sampleBusinessUserRiskScoreComponents(),
    },
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
          'https://find-and-update.company-information.service.gov.uk/company/01772433'
        break
      case 'LINKEDIN':
        url = 'https://www.linkedin.com/company/flagright'
        break
      case 'EXPLORIUM':
        url = 'https://www.explorium.ai/'
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
        sourceValue: `https://${url}`,
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
