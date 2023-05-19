import { uuid4 } from '@sentry/utils'
import { sampleCountry } from './countries'
import { sampleString } from './strings'
import { CompanyRegistrationDetails } from '@/@types/openapi-internal/CompanyRegistrationDetails'
import { KYCStatus } from '@/@types/openapi-internal/KYCStatus'
import { KYCStatusDetails } from '@/@types/openapi-internal/KYCStatusDetails'
import { UserState } from '@/@types/openapi-internal/UserState'
import { UserStateDetails } from '@/@types/openapi-internal/UserStateDetails'
import { pickRandom, randomFloat, randomInt } from '@/utils/prng'
import { USER_STATES } from '@/@types/openapi-internal-custom/UserState'
import { KYC_STATUSS } from '@/@types/openapi-internal-custom/KYCStatus'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { randomIndustry, randomName } from '@/core/seed/samplers/dictionary'
import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { LegalDocument } from '@/@types/openapi-internal/LegalDocument'
import { Tag } from '@/@types/openapi-internal/Tag'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'

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

export function sampleCompanyRegistrationDetails(
  seed?: number
): CompanyRegistrationDetails {
  return {
    registrationIdentifier: sampleString(seed),
    registrationCountry: sampleCountry(seed),
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
  documentNumber: '7474018285741827',
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
  { legalName, country }: { legalName?: string; country?: CountryCode } = {},
  seed = 0.1
): InternalBusinessUser {
  return {
    type: 'BUSINESS',
    userId: uuid4(),
    drsScore: {
      drsScore: randomFloat(seed, 1),
      createdAt: Date.now(),
      isUpdatable: true,
    },
    userStateDetails: sampleUserStateDetails(seed),
    krsScore: {
      krsScore: randomFloat(),
      createdAt: sampleTimestamp(seed),
    },
    kycStatusDetails: sampleKycStatusDetails(seed),
    createdTimestamp: sampleTimestamp(seed),
    legalEntity: {
      contactDetails: {
        emailIds: ['tim@acme.com'],
      },
      companyGeneralDetails: {
        legalName: legalName || randomName(),
        businessIndustry: [randomIndustry()],
      },
      companyRegistrationDetails: sampleCompanyRegistrationDetails(seed),
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
          emailIds: ['first@email.com', 'second@email.com'],
          contactNumbers: ['+4287878787', '+7777777'],
          faxNumbers: ['+999999'],
          websites: ['www.example.com'],
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
        generalDetails: {
          name: {
            firstName: randomName(),
            middleName: randomName(),
            lastName: randomName(),
          },
        },
      },
    ],
  }
}
