import { v4 as uuidv4, v4 as uuid4 } from 'uuid'
import { UserRepository } from '../repositories/user-repository'
import { UserManagementService } from '../../rules-engine/user-rules-engine-service'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { withLocalChangeHandler } from '@/utils/local-dynamodb-change-handler'
import { UserOptional } from '@/@types/openapi-internal/UserOptional'
import { BusinessOptional } from '@/@types/openapi-internal/BusinessOptional'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
dynamoDbSetupHook()
withLocalChangeHandler()

const dynamoDb = getDynamoDbClient()
const tenantID = getTestTenantId()

describe('Test Dynamo Db User Update', () => {
  it('should update user', async () => {
    const userId = uuidv4()
    const user = getTestUser({
      userId,
    })
    const mongoDb = await getMongoDbClient()
    const userRepository = new UserRepository(tenantID, { dynamoDb, mongoDb })

    const createdUser = await userRepository.saveUser(user, 'CONSUMER')

    expect(createdUser).toEqual({ ...user, type: 'CONSUMER' })

    const executedRules: ExecutedRulesResult[] = [
      {
        ruleId: 'r1',
        ruleInstanceId: 'i1',
        ruleName: 'Rule 1',
        ruleDescription: 'This is rule 1',
        ruleAction: 'FLAG',
        ruleHit: true,
      },
      {
        ruleId: 'r2',
        ruleInstanceId: 'i2',
        ruleName: 'Rule 2',
        ruleDescription: 'This is rule 2',
        ruleAction: 'FLAG',
        ruleHit: false,
      },
    ]

    const hitRules: HitRulesDetails[] = [
      {
        ruleId: 'r1',
        ruleInstanceId: 'i1',
        ruleName: 'Rule 1',
        ruleDescription: 'This is rule 1',
        ruleAction: 'FLAG',
      },
      {
        ruleId: 'r2',
        ruleInstanceId: 'i2',
        ruleName: 'Rule 2',
        ruleDescription: 'This is rule 2',
        ruleAction: 'FLAG',
      },
    ]

    const updatedUser = await userRepository.updateUserWithExecutedRules(
      userId,
      executedRules,
      hitRules
    )

    expect(updatedUser).toEqual({
      ...user,
      type: 'CONSUMER',
      executedRules,
      hitRules,
    })

    const getUser = await userRepository.getMongoConsumerUser(userId)

    expect(getUser).toMatchObject({
      ...user,
      type: 'CONSUMER',
      executedRules,
      hitRules,
    })
  })
})

describe('Test User Management Service', () => {
  const tenantId = getTestTenantId()

  it('Test User Events', async () => {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()

    const user = getTestUser({ userId: uuidv4() })

    const userRepository = new UserRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })

    await userRepository.saveUser(user, 'CONSUMER')

    const userResult = await userRepository.getUser(user.userId)
    const mongoUserResult = await userRepository.getMongoConsumerUser(
      user.userId
    )

    expect(mongoUserResult).toMatchObject({ ...user, type: 'CONSUMER' })
    expect(userResult).toEqual({
      ...user,
      type: 'CONSUMER',
    })

    await userRepository.saveUserComment(user.userId, {
      body: 'Test Comment',
    })

    const mongoUserResultWithComment =
      await userRepository.getMongoConsumerUser(user.userId)

    expect(mongoUserResultWithComment).toMatchObject({
      ...user,
      type: 'CONSUMER',
      comments: [{ body: 'Test Comment' }],
    })
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const userManagementService = new UserManagementService(
      tenantId,
      dynamoDb,
      mongoDb,
      logicEvaluator
    )

    const userUpdateableAttributes: UserOptional = {
      employmentStatus: 'PENSIONER',
      userSegment: 'PROFESSIONAL',
      contactDetails: {
        emailIds: ['test@test.com'],
      },
    }

    await userManagementService.verifyConsumerUserEvent({
      timestamp: Date.now(),
      userId: user.userId,
      eventDescription: 'User Created',
      reason: 'User Created',
      updatedConsumerUserAttributes: userUpdateableAttributes,
    })

    const userUpdated = await userRepository.getUser(user.userId)

    const toBeCheckedData = {
      ...user,
      type: 'CONSUMER',
      ...userUpdateableAttributes,
      contactDetails: {
        ...user.contactDetails,
        ...userUpdateableAttributes.contactDetails,
      },
      executedRules: [],
      hitRules: [],
      status: 'ALLOW',
    }

    expect(userUpdated).toEqual(toBeCheckedData)

    const mongoUserUpdated = await userRepository.getMongoConsumerUser(
      user.userId
    )

    expect(mongoUserUpdated).toMatchObject({
      ...toBeCheckedData,
      comments: [{ body: 'Test Comment' }],
    })
  })
})

describe('Test Business User Management Service', () => {
  const tenantId = getTestTenantId()

  it('Test Business User Events', async () => {
    const dynamoDb = getDynamoDbClient()
    const mongoDb = await getMongoDbClient()

    const user = getTestBusiness({ userId: uuidv4() })

    const userRepository = new UserRepository(tenantId, {
      dynamoDb,
      mongoDb,
    })

    await userRepository.saveUser(user, 'BUSINESS')

    const userResult = await userRepository.getUser(user.userId)
    const mongoUserResult = await userRepository.getMongoBusinessUser(
      user.userId
    )

    expect(mongoUserResult).toMatchObject({ ...user, type: 'BUSINESS' })
    expect(userResult).toEqual({
      ...user,
      type: 'BUSINESS',
    })

    await userRepository.saveUserComment(user.userId, {
      body: 'Test Comment',
    })

    const mongoUserResultWithComment =
      await userRepository.getMongoBusinessUser(user.userId)

    expect(mongoUserResultWithComment).toMatchObject({
      ...user,
      type: 'BUSINESS',
      comments: [{ body: 'Test Comment' }],
    })

    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const userManagementService = new UserManagementService(
      tenantId,
      dynamoDb,
      mongoDb,
      logicEvaluator
    )

    const userUpdateableAttributes: BusinessOptional = {
      acquisitionChannel: 'GATHERING',
      mccDetails: {
        code: 1234,
        description: 'Test Description',
      },
      directors: [
        {
          userId: uuid4(),
          generalDetails: {
            name: {
              firstName: 'Test',
              lastName: 'Test',
            },
          },
        },
      ],
    }

    await userManagementService.verifyBusinessUserEvent({
      timestamp: Date.now(),
      userId: user.userId,
      eventDescription: 'User Created',
      reason: 'User Created',
      updatedBusinessUserAttributes: userUpdateableAttributes,
    })

    const userUpdated = await userRepository.getBusinessUser(user.userId)

    const toBeCheckedData = {
      ...user,
      type: 'BUSINESS',
      ...userUpdateableAttributes,
      status: 'ALLOW',
      executedRules: [],
      hitRules: [],
    }

    expect(userUpdated).toEqual(toBeCheckedData)

    const mongoUserUpdated = await userRepository.getMongoBusinessUser(
      user.userId
    )

    expect(mongoUserUpdated).toMatchObject({
      ...toBeCheckedData,
      comments: [{ body: 'Test Comment' }],
    })
  })
})
