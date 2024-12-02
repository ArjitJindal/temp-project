import { PassThrough, Readable } from 'node:stream'
import { ListService } from '..'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getS3ClientByEvent } from '@/utils/s3'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { iterateItems } from '@/utils/pagination'
import { ListItem } from '@/@types/openapi-public/ListItem'
import { getUserName } from '@/utils/helpers'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'

dynamoDbSetupHook()

describe('Bulk upload', () => {
  const TEST_TENANT_ID = getTestTenantId()

  const user1 = getTestUser({
    userId: 'user01',
    type: 'CONSUMER',
    userDetails: {
      name: {
        firstName: 'Vladimir',
        lastName: 'Putin',
      },
    },
  })

  const user2 = getTestUser({
    userId: 'user02',
    type: 'CONSUMER',
    userDetails: {
      name: {
        firstName: 'Aman',
        lastName: 'Dugar',
      },
    },
  })

  const otherUsers = [...new Array(200)].map((_, i) =>
    getTestUser({
      userId: `other_user_${i}`,
      type: 'CONSUMER',
      userDetails: {
        name: {
          firstName: `Other ${i}`,
          lastName: `User ${i}`,
        },
      },
    })
  )

  const allUsers = [user1, user2, ...otherUsers]
  setUpUsersHooks(TEST_TENANT_ID, allUsers)

  test('Create whitelist', async () => {
    const listService = await getService(TEST_TENANT_ID)
    const list = await listService.createList('WHITELIST', 'IBAN_NUMBER')
    expect(list.header.size).toEqual(0)
    const result = await listService.importCsvFromStream(
      list.listId,
      stringStream(`DE111111\nUS666666\n`)
    )
    expect(result.successRows).toEqual(2)
    const newList = await listService.getListHeader(list.listId)
    expect(newList?.size).toEqual(2)
  })
  describe('Metadata synching', () => {
    test('User list should be fulfilled with user data', async () => {
      const listService = await getService(TEST_TENANT_ID)
      const list = await listService.createList('WHITELIST', 'USER_ID')
      expect(list.header.size).toEqual(0)
      const csv = [`user01`, `unknown`, `user02`].join('\n')
      const result = await listService.importCsvFromStream(
        list.listId,
        stringStream(csv)
      )
      expect(result.successRows).toEqual(3)

      const listItems = await listService.getListItems(list.listId)

      expect(listItems.count).toEqual(3)
      expect(listItems.items).toEqual(
        expect.arrayContaining([
          {
            key: 'user01',
            metadata: { userFullName: 'Vladimir Putin' },
          },
          {
            key: 'user02',
            metadata: { userFullName: 'Aman Dugar' },
          },
          {
            key: 'unknown',
            metadata: {},
          },
        ])
      )
    })
    test('Check for large CSV files with most users unknown ', async () => {
      const listService = await getService(TEST_TENANT_ID)
      const list = await listService.createList('WHITELIST', 'USER_ID')
      expect(list.header.size).toEqual(0)
      const csv = ['user01', ...new Array(300), 'user02']
        .map((x, i) => x || `unknown#${i}`)
        .join('\n')
      const result = await listService.importCsvFromStream(
        list.listId,
        stringStream(csv)
      )
      expect(result.successRows).toEqual(302)

      const allItems: ListItem[] = []
      for await (const item of iterateItems((pagination) =>
        listService.getListItems(list.listId, pagination)
      )) {
        allItems.push(item)
      }
      expect(allItems).toHaveLength(302)
      expect(allItems).toEqual(
        expect.arrayContaining([
          {
            key: 'user01',
            metadata: { userFullName: 'Vladimir Putin' },
          },
          {
            key: 'user02',
            metadata: { userFullName: 'Aman Dugar' },
          },
        ])
      )
    })

    test('Check for large existed users count', async () => {
      // Load CSV data
      const listService = await getService(TEST_TENANT_ID)
      const list = await listService.createList('WHITELIST', 'USER_ID')
      expect(list.header.size).toEqual(0)
      const csv = [...allUsers, ...new Array(100)]
        .map((x, i) => x?.userId || `unknown#${i}`)
        .join('\n')
      const result = await listService.importCsvFromStream(
        list.listId,
        stringStream(csv)
      )
      expect(result.successRows).toEqual(302)

      // Fetch all items
      const allItems: ListItem[] = []
      for await (const item of iterateItems((pagination) =>
        listService.getListItems(list.listId, pagination)
      )) {
        allItems.push(item)
      }

      // Check that all users fulfilled
      expect(allItems).toHaveLength(302)
      expect(allItems).toEqual(
        expect.arrayContaining(
          allUsers.map((user) => ({
            key: user.userId,
            metadata: { userFullName: getUserName(user) },
          }))
        )
      )
    })
    test('When updating users in dynamo, lists should be updated too', async () => {
      const dynamoDb = getDynamoDbClient()
      const mongoDb = await getMongoDbClient()
      const userRepository = new UserRepository(TEST_TENANT_ID, {
        dynamoDb,
        mongoDb,
      })

      // Create user
      const newUser1 = getTestUser({
        type: 'CONSUMER',
        userDetails: {
          name: {
            firstName: 'Vladimir',
            lastName: 'Putin',
          },
        },
      })
      await userRepository.saveUserMongo(newUser1 as InternalConsumerUser)

      // Create second user but don't save it yet
      const newUser2 = getTestUser({
        type: 'CONSUMER',
        userDetails: {
          name: {
            firstName: 'Ramzan',
            lastName: 'Kadyrov',
          },
        },
      })

      // Load CSV data
      const listService = await getService(TEST_TENANT_ID)
      const list = await listService.createList('WHITELIST', 'USER_ID')
      expect(list.header.size).toEqual(0)
      const csv = `${newUser1.userId}\n${newUser2.userId}`
      const result = await listService.importCsvFromStream(
        list.listId,
        stringStream(csv)
      )
      expect(result.successRows).toEqual(2)

      // Check that first user fulfilled and second is not
      {
        const listItem1 = await listService.getListItem(
          list.listId,
          newUser1.userId
        )
        expect(listItem1).toEqual({
          key: newUser1.userId,
          metadata: { userFullName: 'Vladimir Putin' },
        })
        const listItem2 = await listService.getListItem(
          list.listId,
          newUser2.userId
        )
        expect(listItem2).toEqual({
          key: newUser2.userId,
          metadata: {},
        })
      }

      // Change first user data
      newUser1.userDetails = {
        ...newUser1.userDetails,
        name: {
          ...newUser1.userDetails?.name,
          firstName: 'Vova',
        },
      }
      await userRepository.saveUserMongo(newUser1 as InternalConsumerUser)
      // Save second user
      await userRepository.saveUserMongo(newUser2 as InternalConsumerUser)
      // Sync list
      await listService.syncListMetadata(list.listId)

      // Check that both users synched with list
      {
        const listItem1 = await listService.getListItem(
          list.listId,
          newUser1.userId
        )
        expect(listItem1).toEqual({
          key: newUser1.userId,
          metadata: { userFullName: 'Vova Putin' },
        })
        const listItem2 = await listService.getListItem(
          list.listId,
          newUser2.userId
        )
        expect(listItem2).toEqual({
          key: newUser2.userId,
          metadata: { userFullName: 'Ramzan Kadyrov' },
        })
      }

      // Clean up
      await userRepository.deleteUser(newUser1.userId)
      await userRepository.deleteUser(newUser2.userId)
    })
  })
})

/*
  Helpers
 */
function stringStream(string: string): Readable {
  const stream = new PassThrough()
  stream.push(string)
  stream.end()
  return stream
}

async function getService(TEST_TENANT_ID: string): Promise<ListService> {
  const dynamoDb = getDynamoDbClient()
  const mongoDb = await getMongoDbClient()
  const s3 = getS3ClientByEvent(null as any)
  const listService = new ListService(
    TEST_TENANT_ID,
    { dynamoDb, mongoDb },
    s3,
    {
      documentBucketName: 'test-bucket',
      tmpBucketName: 'test-bucket',
    }
  )
  return listService
}
