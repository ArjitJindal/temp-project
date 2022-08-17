import { getTestDynamoDbClient } from './dynamodb-test-utils'
import { User } from '@/@types/openapi-public/User'
import { UserRepository } from '@/services/users/repositories/user-repository'

export function getTestUser(user: Partial<User> = {}): User {
  return {
    createdTimestamp: 1641654664,
    userId: '96647cfd9e8fe66ee0f3362e011e34e8',
    userDetails: {
      name: {
        firstName: 'Baran',
        middleName: 'Realblood',
        lastName: 'Ozkan',
      },
      dateOfBirth: '1990-01-01',
      countryOfResidence: 'US',
      countryOfNationality: 'DE',
    },
    legalDocuments: [
      {
        documentType: 'passport',
        documentNumber: 'Z9431P',
        documentIssuedDate: 1639939034000,
        documentExpirationDate: 1839939034000,
        documentIssuedCountry: 'DE',
        tags: [
          {
            key: 'customerType',
            value: 'wallet',
          },
        ],
      },
    ],
    contactDetails: {
      emailIds: ['baran@flagright.com'],
      contactNumbers: ['+37112345432'],
      websites: ['flagright.com'],
      addresses: [
        {
          addressLines: ['Klara-Franke Str 20'],
          postcode: '10557',
          city: 'Berlin',
          state: 'Berlin',
          country: 'Germany',
          tags: [
            {
              key: 'customKey',
              value: 'customValue',
            },
          ],
        },
      ],
    },
    tags: [
      {
        key: 'customKey',
        value: 'customValue',
      },
    ],
    ...user,
  }
}

export async function createConsumerUser(testTenantId: string, user: User) {
  const dynamoDb = getTestDynamoDbClient()
  const userRepository = new UserRepository(testTenantId, { dynamoDb })
  const createdUser = await userRepository.saveConsumerUser(user)
  return async () => {
    await userRepository.deleteUser(createdUser.userId)
  }
}

export function setUpConsumerUsersHooks(tenantId: string, users: Array<User>) {
  const cleanups: Array<() => void> = [
    async () => {
      return
    },
  ]

  beforeAll(async () => {
    for (const user of users) {
      cleanups.push(await createConsumerUser(tenantId, user))
    }
  })
  afterAll(async () => {
    await Promise.all(cleanups.map((cleanup) => cleanup()))
  })
}
