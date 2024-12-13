import { v4 as uuid4 } from 'uuid'
import { LinkerService } from '@/services/linker'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { TransactionSampler } from '@/core/seed/samplers/transaction'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

describe('Linker', () => {
  test('Single user', async () => {
    const tenantId = getTestTenantId()
    const mongoClient = await getMongoDbClient()
    const db = mongoClient.db()

    const userCollection = db.collection<InternalUser>(
      USERS_COLLECTION(tenantId)
    )
    await userCollection.insertMany([
      {
        type: 'BUSINESS',
        userId: 'u1',
        createdTimestamp: 0,
        legalEntity: {
          companyGeneralDetails: { legalName: 'Acme' },
          contactDetails: {
            emailIds: ['tim@flagright.com'],
          },
        },
      },
    ])

    const ls = new LinkerService(tenantId)
    const entity = await ls.entity('u1')
    expect(entity.linkedUsers.size).toBe(1)
    expect(entity.paymentMethodLinked.size).toBe(0)
    expect(entity.addressLinked.size).toBe(0)
    expect(entity.emailLinked.size).toBe(0)
    expect(entity.phoneLinked.size).toBe(0)
  })

  test('Users are linked by transaction payment methods', async () => {
    const tenantId = getTestTenantId()
    const mongoClient = await getMongoDbClient()
    const db = mongoClient.db()

    const userCollection = db.collection<InternalUser>(
      USERS_COLLECTION(tenantId)
    )
    await userCollection.insertMany([
      {
        type: 'BUSINESS',
        userId: 'u1',
        createdTimestamp: 0,
        legalEntity: {
          companyGeneralDetails: { legalName: 'Acme' },
        },
      },
      {
        type: 'BUSINESS',
        userId: 'u2',
        createdTimestamp: 0,
        legalEntity: {
          companyGeneralDetails: { legalName: 'Acme' },
        },
      },
    ])

    const txnCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    const transactionSampler = new TransactionSampler(0)
    await txnCollection.insertMany([
      {
        ...transactionSampler.getSample(undefined, { originUserId: 'u1' }),
        originPaymentMethodId: 'someiban',
      },
      {
        ...transactionSampler.getSample(undefined, { destinationUserId: 'u2' }),
        destinationPaymentMethodId: 'someiban',
      },
    ])

    const ls = new LinkerService(tenantId)
    const entity = await ls.entity('u1')

    expect(entity.paymentMethodLinked.size).toBe(1)
    expect(entity.paymentMethodLinked.get('someiban')).toHaveLength(2)
    expect(entity.addressLinked.size).toBe(0)
    expect(entity.emailLinked.size).toBe(0)
    expect(entity.phoneLinked.size).toBe(0)
  })

  test('Users are linked by email', async () => {
    const tenantId = getTestTenantId()
    const mongoClient = await getMongoDbClient()
    const db = mongoClient.db()

    const userCollection = db.collection<InternalUser>(
      USERS_COLLECTION(tenantId)
    )
    await userCollection.insertMany([
      {
        type: 'BUSINESS',
        userId: 'u1',
        createdTimestamp: 0,
        legalEntity: {
          companyGeneralDetails: { legalName: 'Acme' },
          contactDetails: {
            emailIds: ['tim@flagright.com'],
          },
        },
      },
      {
        type: 'BUSINESS',
        userId: 'u2',
        createdTimestamp: 0,
        legalEntity: {
          companyGeneralDetails: { legalName: 'Block' },
          contactDetails: {
            emailIds: ['john@flagright.com'],
          },
        },
        shareHolders: [
          {
            userId: uuid4(),
            contactDetails: {
              emailIds: ['tim@flagright.com'],
            },
            generalDetails: {
              name: {
                firstName: 'Tim',
                lastName: 'Coulson',
              },
            },
          },
        ],
      },
    ])

    const ls = new LinkerService(tenantId)
    const entity = await ls.entity('u1')

    expect(entity.addressLinked.size).toBe(0)
    expect(entity.phoneLinked.size).toBe(0)
    expect(entity.emailLinked.size).toBe(1)
    expect(entity.emailLinked.get('tim@flagright.com')).toHaveLength(2)
  })
  test('Users are linked by phone number', async () => {
    const tenantId = getTestTenantId()
    const mongoClient = await getMongoDbClient()
    const db = mongoClient.db()

    const userCollection = db.collection<InternalUser>(
      USERS_COLLECTION(tenantId)
    )
    await userCollection.insertMany([
      {
        type: 'BUSINESS',
        userId: 'u1',
        createdTimestamp: 0,
        legalEntity: {
          companyGeneralDetails: { legalName: 'Acme' },
          contactDetails: {
            contactNumbers: ['123456789'],
          },
        },
      },
      {
        type: 'BUSINESS',
        userId: 'u2',
        createdTimestamp: 0,
        legalEntity: {
          companyGeneralDetails: { legalName: 'Glitter Corp' },
          contactDetails: {
            contactNumbers: ['4030303'],
          },
        },
        shareHolders: [
          {
            userId: uuid4(),
            generalDetails: {
              name: {
                firstName: 'Tim',
                lastName: 'Coulson',
              },
            },
            contactDetails: {
              contactNumbers: ['123456789'],
            },
          },
        ],
      },
    ])

    const ls = new LinkerService(tenantId)
    const entity = await ls.entity('u1')

    expect(entity.emailLinked.size).toBe(0)
    expect(entity.addressLinked.size).toBe(0)
    expect(entity.phoneLinked.size).toBe(1)
    expect(entity.phoneLinked.get('123456789')).toHaveLength(2)
  })

  test('Users wih no links', async () => {
    const tenantId = getTestTenantId()
    const mongoClient = await getMongoDbClient()
    const db = mongoClient.db()

    const userCollection = db.collection<InternalUser>(
      USERS_COLLECTION(tenantId)
    )
    await userCollection.insertMany([
      {
        type: 'BUSINESS',
        userId: 'u1',
        createdTimestamp: 0,
        legalEntity: {
          companyGeneralDetails: { legalName: 'Acme' },
        },
      },
      {
        type: 'BUSINESS',
        userId: 'u2',
        createdTimestamp: 0,
        legalEntity: {
          companyGeneralDetails: { legalName: 'Glitter Corp' },
        },
      },
    ])

    const ls = new LinkerService(tenantId)
    const entity = await ls.entity('u1')

    expect(entity.emailLinked.size).toBe(0)
    expect(entity.addressLinked.size).toBe(0)
    expect(entity.phoneLinked.size).toBe(0)
    expect(entity.paymentMethodLinked.size).toBe(0)
  })
})
