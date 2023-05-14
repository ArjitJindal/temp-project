import { uuid4 } from '@sentry/utils'
import {
  sampleCompanyRegistrationDetails,
  sampleKycStatusDetails,
  sampleUserStateDetails,
} from '@/core/seed/samplers/users'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { Tag } from '@/@types/openapi-internal/Tag'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { LegalDocument } from '@/@types/openapi-internal/LegalDocument'
import { pickRandom, randomFloat } from '@/utils/prng'
import {
  companies,
  randomIndustry,
  randomName,
} from '@/core/seed/samplers/dictionary'
import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { RISK_LEVEL1S } from '@/@types/openapi-internal-custom/RiskLevel1'

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

const businessUsers: InternalBusinessUser[] = [
  ...companies.map(
    (c, i): InternalBusinessUser => ({
      type: 'BUSINESS',
      userId: uuid4(),
      drsScore: {
        drsScore: randomFloat(i, 1),
        createdAt: Date.now(),
        isUpdatable: true,
      },
      userStateDetails: sampleUserStateDetails(i),
      krsScore: {
        krsScore: randomFloat(),
        createdAt: sampleTimestamp(i),
      },
      kycStatusDetails: sampleKycStatusDetails(i),
      createdTimestamp: sampleTimestamp(i),
      legalEntity: {
        contactDetails: {
          emailIds: ['tim@acme.com'],
        },
        companyGeneralDetails: {
          legalName: c,
          businessIndustry: [randomIndustry()],
        },
        companyRegistrationDetails: sampleCompanyRegistrationDetails(i),
      },
      shareHolders: [
        {
          generalDetails: {
            name: {
              firstName: randomName(),
              middleName: randomName(),
              lastName: randomName(),
            },
            countryOfResidence: pickRandom(COUNTRY_CODES, i),
            countryOfNationality: pickRandom(COUNTRY_CODES, i),
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
    })
  ),
]

const consumerUsers: InternalConsumerUser[] = [
  ...[...new Array(30)].map(
    (_, i): InternalConsumerUser => ({
      type: 'CONSUMER' as const,
      userId: uuid4(),
      drsScore: {
        drsScore: randomFloat(i, 1),
        createdAt: Date.now(),
        isUpdatable: true,
      },
      riskLevel: pickRandom(RISK_LEVEL1S, i),
      userStateDetails: sampleUserStateDetails(0.9 * i),
      kycStatusDetails: sampleKycStatusDetails(0.9 * i),
      userDetails: {
        dateOfBirth: new Date(sampleTimestamp(i * 0.1)).toISOString(),
        countryOfResidence: pickRandom(COUNTRY_CODES, i * 0.1),
        countryOfNationality: pickRandom(COUNTRY_CODES, i * 0.1),
        name: {
          firstName: randomName(),
          middleName: randomName(),
          lastName: randomName(),
        },
      },
      createdTimestamp: sampleTimestamp(0.9 * i),
    })
  ),
]

const data: (Business | User)[] = [...businessUsers, ...consumerUsers]

export = data
