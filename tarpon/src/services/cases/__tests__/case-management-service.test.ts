import { shortId } from '@flagright/lib/utils'
import { ExternalCaseManagementService } from '../external-case-management-service'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { Account, AccountsService } from '@/services/accounts'
import { CaseCreationRequest } from '@/@types/openapi-public-management/CaseCreationRequest'
import { getTestUser, setUpUsersHooks } from '@/test-utils/user-test-utils'
import { getS3ClientByEvent } from '@/utils/s3'

dynamoDbSetupHook()

const accounts: Account[] = [
  {
    blocked: false,
    email: 'test@gmail.com',
    id: '1',
    emailVerified: true,
    isEscalationContact: false,
    name: 'test',
    role: 'admin',
  },
  {
    blocked: false,
    email: 'test2@gmail.com',
    id: '2',
    emailVerified: true,
    isEscalationContact: false,
    name: 'test 2',
    role: 'admin',
  },
]

const getCaseManagementService = async (tenantId: string) => {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const s3 = getS3ClientByEvent(null as any)
  return new ExternalCaseManagementService(
    tenantId,
    { mongoDb, dynamoDb },
    s3,
    { documentBucketName: 'test', tmpBucketName: 'test' }
  )
}

describe('Test Create Case', () => {
  const tenantId = getTestTenantId()

  setUpUsersHooks(tenantId, [getTestUser({ userId: '1' })])

  jest
    .spyOn(AccountsService.prototype, 'getAllAccountsMongo')
    .mockResolvedValue(accounts)

  it('Should throw an error on invalid case id', async () => {
    const caseService = await getCaseManagementService(tenantId)
    const caseCreationRequest: CaseCreationRequest = {
      caseId: 'C-1',
      entityDetails: {
        type: 'USER',
        userId: '1',
      },
      priority: 'P1',
      createdTimestamp: Date.now(),
    }

    const createCase = caseService.createCase(caseCreationRequest)

    await expect(createCase).rejects.toThrowError(
      'Case id: C-1 not allowed for creation reserving C-{number} for internal cases'
    )
  })

  it('Should throw an error on duplicate case id', async () => {
    const caseService = await getCaseManagementService(tenantId)
    const caseCreationRequest: CaseCreationRequest = {
      caseId: shortId(),
      entityDetails: {
        type: 'USER',
        userId: '1',
      },
      priority: 'P1',
      createdTimestamp: Date.now(),
    }

    await caseService.createCase(caseCreationRequest)
    const createCase2 = caseService.createCase(caseCreationRequest)

    await expect(createCase2).rejects.toThrowError(
      `Case with id: ${caseCreationRequest.caseId} already exists. Please provide a case id which does not exist`
    )
  })

  it('Should throw an error on case id too long', async () => {
    const caseService = await getCaseManagementService(tenantId)
    const caseCreationRequest: CaseCreationRequest = {
      caseId: 'a'.repeat(41),
      entityDetails: {
        type: 'USER',
        userId: '1',
      },
      priority: 'P1',
      createdTimestamp: Date.now(),
    }

    const createCase = caseService.createCase(caseCreationRequest)

    await expect(createCase).rejects.toThrowError(
      'Case id: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa is too long. We only support case ids upto 40 characters'
    )
  })

  test('Should throw an error on assignee email not found', async () => {
    const caseService = await getCaseManagementService(tenantId)
    const caseCreationRequest: CaseCreationRequest = {
      caseId: shortId(),
      entityDetails: {
        type: 'USER',
        userId: '1',
      },
      priority: 'P1',
      assignments: [
        {
          assigneeEmail: 'test3@gmail.com',
        },
      ],
      createdTimestamp: Date.now(),
    }

    const createCase = caseService.createCase(caseCreationRequest)

    await expect(createCase).rejects.toThrowError(
      'Assignee email test3@gmail.com not found'
    )
  })

  it('Should create a case and return the transformed external case', async () => {
    const caseService = await getCaseManagementService(tenantId)
    const caseId = shortId()
    const caseCreationRequest: CaseCreationRequest = {
      caseId,
      entityDetails: {
        type: 'USER',
        userId: '1',
      },
      priority: 'P1',
      assignments: [
        {
          assigneeEmail: 'test@gmail.com',
        },
      ],
      createdTimestamp: Date.now(),
    }

    await caseService.createCase(caseCreationRequest)

    const createdCase = await caseService.getCaseById(caseId)

    expect(createdCase.caseId).toEqual(caseId)
    expect(createdCase.entityDetails.type).toEqual('USER')
    expect(createdCase.priority).toEqual('P1')
    expect(createdCase.assignments?.[0].assigneeEmail).toEqual('test@gmail.com')

    await caseService.updateCase(caseId, {
      priority: 'P2',
    })

    const updatedCase = await caseService.getCaseById(caseId)

    expect(updatedCase.priority).toEqual('P2')
    expect(updatedCase.assignments?.[0].assigneeEmail).toEqual('test@gmail.com')

    await caseService.updateCase(caseId, {
      priority: 'P3',
      assignments: [
        {
          assigneeEmail: 'test2@gmail.com',
        },
      ],
    })

    const updatedCase2 = await caseService.getCaseById(caseId)

    expect(updatedCase2.priority).toEqual('P3')
    expect(updatedCase2.assignments?.[0].assigneeEmail).toEqual(
      'test2@gmail.com'
    )
  })

  test('Should throw an error on invalid case which not exists', async () => {
    const caseService = await getCaseManagementService(tenantId)

    const getCase = caseService.getCaseById('C-1')

    await expect(getCase).rejects.toThrowError('Case not found')
  })

  test('Should throw an error on invalid case update which not exists', async () => {
    const caseService = await getCaseManagementService(tenantId)

    const updateCase = caseService.updateCase('C-1', {
      priority: 'P1',
    })

    await expect(updateCase).rejects.toThrowError(
      'Case with id: C-1 not found. You can create a new case by calling POST /cases with id: C-1'
    )
  })
})
