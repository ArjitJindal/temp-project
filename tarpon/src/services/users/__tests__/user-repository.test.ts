import { v4 as uuidv4 } from 'uuid'
import { UserRepository } from '../repositories/user-repository'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import {
  disableLocalChangeHandler,
  enableLocalChangeHandler,
} from '@/utils/local-dynamodb-change-handler'

dynamoDbSetupHook()

const dynamoDb = getDynamoDbClient()
const tenantID = getTestTenantId()

describe('Test Dynamo Db User Update', () => {
  beforeAll(() => {
    enableLocalChangeHandler()
  })
  afterAll(() => {
    disableLocalChangeHandler()
  })
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
