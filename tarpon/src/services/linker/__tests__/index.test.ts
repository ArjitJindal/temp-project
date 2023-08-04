import { LinkerService } from '@/services/linker'
import {
  getMongoDbClient,
  TRANSACTIONS_COLLECTION,
  USERS_COLLECTION,
} from '@/utils/mongoDBUtils'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { sampleTransaction } from '@/core/seed/samplers/transaction'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'

describe('Linker', () => {
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
    await txnCollection.insertMany([
      {
        ...sampleTransaction({
          originUserId: 'u1',
        }),
        originPaymentMethodId: 'someiban',
      },
      {
        ...sampleTransaction({
          destinationUserId: 'u2',
        }),
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
})

describe('Visualisation', () => {
  test('Users sharing email', async () => {
    const ls = new LinkerService('tenantId')
    const labels = new Map<string, string>([
      ['u1', 'Tim Coulson'],
      ['u2', 'Madhu Nadig'],
    ])
    const emailLinked = new Map<string, string[]>([
      ['tim@flagright.com', ['u1', 'u2']],
    ])
    const addressLInked = new Map<string, string[]>()
    const phoneLinked = new Map<string, string[]>()
    const paymentMethodLinked = new Map<string, string[]>()

    expect(
      ls.visualisation(
        'u1',
        labels,
        emailLinked,
        addressLInked,
        phoneLinked,
        paymentMethodLinked
      )
    ).toEqual({
      nodes: [
        {
          id: 'user:u1',
          label: 'Tim Coulson',
        },
        {
          id: 'user:u2',
          label: 'Madhu Nadig',
        },
        {
          id: 'emailAddress:tim@flagright.com',
          label: '',
        },
      ],
      edges: [
        {
          id: 'user:u1-emailAddress:tim@flagright.com',
          source: 'user:u1',
          target: 'emailAddress:tim@flagright.com',
        },
        {
          id: 'user:u2-emailAddress:tim@flagright.com',
          source: 'user:u2',
          target: 'emailAddress:tim@flagright.com',
        },
      ],
    })
  })
})
