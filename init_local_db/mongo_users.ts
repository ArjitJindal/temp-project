import { Tag } from '../src/@types/openapi-internal/Tag'
import { User } from '../src/@types/openapi-public/User'
import { Business } from '../src/@types/openapi-public/Business'
import { InternalBusinessUser } from '../src/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '../src/@types/openapi-internal/InternalConsumerUser'
import { LegalDocument } from '../src/@types/openapi-internal/LegalDocument'

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
    firstName: 'Share',
    middleName: 'Holder',
    lastName: 'Number-One',
  },
}

const businessUsers: InternalBusinessUser[] = [
  {
    type: 'BUSINESS',
    userId: 'businessUser_1',
    legalEntity: {
      companyGeneralDetails: {
        legalName: 'Some company',
      },
    },
    createdTimestamp: Date.now(),
    shareHolders: [
      {
        generalDetails: {
          name: {
            firstName: 'Share',
            middleName: 'Holder',
            lastName: 'Number-One',
          },
          countryOfResidence: 'US',
          countryOfNationality: 'GB',
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
            firstName: 'Another',
            middleName: 'Holder',
            lastName: 'Lastname',
          },
        },
      },
    ],
    directors: [
      {
        generalDetails: {
          name: {
            firstName: 'John',
            middleName: 'Lewis',
            lastName: 'Dow',
          },
        },
      },
    ],
  },
  {
    type: 'BUSINESS',
    userId: 'businessUser_2',
    legalEntity: {
      companyGeneralDetails: {
        legalName: 'Some company',
      },
    },
    createdTimestamp: generateRandomTimestamp(),
    shareHolders: [],
    directors: [],
  },
]

const consumerUsers: InternalConsumerUser[] = [
  {
    type: 'CONSUMER',
    userId: 'originUserId_1',
    userDetails: {
      name: {
        firstName: 'Isle',
        middleName: 'O.',
        lastName: 'Man',
      },
    },
    createdTimestamp: generateRandomTimestamp(),
  },
  {
    type: 'CONSUMER',
    userId: 'originUserId_2',
    userDetails: {
      name: {
        firstName: 'John',
        middleName: 'M.',
        lastName: 'Do',
      },
    },
    createdTimestamp: generateRandomTimestamp(),
  },
  {
    type: 'CONSUMER',
    userId: 'originUserId_3',
    userDetails: {
      name: {
        firstName: 'Jack',
        middleName: 'S.',
        lastName: 'London',
      },
    },
    createdTimestamp: generateRandomTimestamp(),
  },
  {
    type: 'CONSUMER',
    userId: 'originUserId_4',
    userDetails: {
      name: {
        firstName: 'Martin',
        middleName: 'Fon',
        lastName: 'Zinger',
      },
    },
    createdTimestamp: generateRandomTimestamp(),
  },
]

const data: (Business | User)[] = [...businessUsers, ...consumerUsers]

export = data
