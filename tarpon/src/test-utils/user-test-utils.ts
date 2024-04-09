import { uniq } from 'lodash'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { Business } from '@/@types/openapi-public/Business'
import { Transaction } from '@/@types/openapi-public/Transaction'
import { User } from '@/@types/openapi-public/User'
import { RiskScoringService } from '@/services/risk-scoring'
import { isConsumerUser } from '@/services/rules-engine/utils/user-rule-utils'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'

export function getTestUser(
  user: Partial<User | InternalUser> = {}
): User | InternalUser {
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

export function getTestBusiness(
  business: Partial<Business | InternalBusinessUser> = {}
): Business | InternalBusinessUser {
  return {
    createdTimestamp: 1641654664,
    userId: 'test-business-id',
    legalEntity: { companyGeneralDetails: { legalName: 'Test Business' } },
    ...business,
  }
}

export async function createConsumerUsers(
  testTenantId: string,
  users: Array<User | InternalUser>
) {
  for (const user of users) {
    await createConsumerUser(testTenantId, user)
  }
}

export const createUserIfNotExists = async (
  tenantId: string,
  user: User | InternalUser
): Promise<() => Promise<void>> => {
  const dynamoDb = getDynamoDbClient()

  const userRepository = new UserRepository(tenantId, { dynamoDb })
  const existingUser = await userRepository.getUser(user.userId)
  if (!existingUser) {
    return await createConsumerUser(tenantId, user)
  }
  return async () => {
    await userRepository.deleteUser(user.userId)
  }
}

export async function createUsersForTransactions(
  tenantId: string,
  transactions: Transaction[]
): Promise<Array<() => Promise<void>>> {
  const cleanUps: Array<() => Promise<void>> = []

  const userIds = uniq(
    transactions
      .flatMap((t) => [t.originUserId, t.destinationUserId])
      .filter(Boolean) as string[]
  )

  cleanUps.concat(
    await Promise.all(
      userIds.map(async (userId) => {
        return await createUserIfNotExists(tenantId, getTestUser({ userId }))
      })
    )
  )

  return cleanUps
}

export async function createConsumerUser(
  testTenantId: string,
  user: User | InternalUser
) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const userRepository = new UserRepository(testTenantId, { dynamoDb, mongoDb })
  const riskScoringService = new RiskScoringService(testTenantId, {
    dynamoDb,
    mongoDb,
  })
  await riskScoringService.updateInitialRiskScores(user)
  const createdUser = await userRepository.saveConsumerUser(user)
  await userRepository.saveUserMongo(createdUser as InternalUser)
  return async () => {
    await userRepository.deleteUser(createdUser.userId)
    await userRepository.deleteUserMongo(createdUser.userId)
  }
}

export async function createBusinessUsers(
  testTenantId: string,
  users: Business[]
) {
  for (const user of users) {
    await createBusinessUser(testTenantId, user)
  }
}

export async function createBusinessUser(testTenantId: string, user: Business) {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const userRepository = new UserRepository(testTenantId, { dynamoDb, mongoDb })
  const riskScoringService = new RiskScoringService(testTenantId, {
    dynamoDb,
    mongoDb,
  })
  await riskScoringService.updateInitialRiskScores(user)
  const createdUser = await userRepository.saveBusinessUser(user)

  await userRepository.saveUserMongo(createdUser as InternalUser)
  return async () => {
    await userRepository.deleteUser(createdUser.userId)
    await userRepository.deleteUserMongo(createdUser.userId)
  }
}

export function setUpUsersHooks(
  tenantId: string,
  users: Array<User | Business>
) {
  const cleanups: Array<() => void> = [
    async () => {
      return
    },
  ]

  beforeAll(async () => {
    for (const user of users) {
      cleanups.push(
        isConsumerUser(user)
          ? await createConsumerUser(tenantId, user as User)
          : await createBusinessUser(tenantId, user as Business)
      )
    }
  })
  afterAll(async () => {
    await Promise.all(cleanups.map((cleanup) => cleanup()))
  })
}
