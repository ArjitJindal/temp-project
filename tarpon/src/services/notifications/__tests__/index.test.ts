import { NotificationRepository } from '../notifications-repository'
import { ConsoleNotifications } from '../console-notifications'
import { casesHandler } from '@/lambdas/console-api-case/app'
import { CaseRepository } from '@/services/cases/repository'
import {
  getApiGatewayPatchEvent,
  getApiGatewayPostEvent,
} from '@/test-utils/apigateway-test-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import * as Context from '@/core/utils/context'
import { NotificationsService } from '@/services/notifications'
import { Account } from '@/@types/openapi-internal/Account'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import { PERMISSIONS } from '@/@types/openapi-internal-custom/Permission'
import { Case } from '@/@types/openapi-internal/Case'
import { withFeatureHook } from '@/test-utils/feature-test-utils'
import { CaseEscalationRequest } from '@/@types/openapi-internal/CaseEscalationRequest'
import { AccountsService } from '@/services/accounts'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getTestUser } from '@/test-utils/user-test-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { allUsersViewHandler } from '@/lambdas/console-api-user/app'
import { Notification } from '@/@types/openapi-internal/Notification'

dynamoDbSetupHook()
withFeatureHook(['NOTIFICATIONS', 'ADVANCED_WORKFLOWS'])

const getContextMocker = jest.spyOn(Context, 'getContext')

const getTestCase = (case_: Partial<Case> = {}): Case => {
  return {
    caseType: 'SYSTEM',
    caseAggregates: {
      destinationPaymentMethods: [],
      originPaymentMethods: [],
      tags: [],
    },
    caseId: `C-${Date.now()}`,
    caseStatus: 'OPEN',
    assignments: [],
    alerts: [
      {
        alertId: `A-${Date.now()}`,
        alertStatus: 'OPEN',
        assignments: [],
        createdTimestamp: Date.now(),
        numberOfTransactionsHit: 0,
        priority: 'P1',
        ruleAction: 'ALLOW',
        ruleDescription: 'Test rule',
        ruleInstanceId: `R-${Date.now()}`,
        ruleName: 'Test rule',
      },
    ],
    ...case_,
  }
}

const getSpyes = (users: Account[], roles: AccountRole[]) => {
  jest
    .spyOn(NotificationsService.prototype as any, 'getAllUsers')
    .mockReturnValue(users)

  jest
    .spyOn(NotificationsService.prototype as any, 'getAllRoles')
    .mockReturnValue(roles)

  jest
    .spyOn(NotificationsService.prototype as any, 'getRoleById')
    .mockImplementation((async (roleId: string) => {
      return roles.find((role) => role.id === roleId) as AccountRole
    }) as any)

  jest
    .spyOn(AccountsService.prototype, 'getAllActiveAccounts')
    .mockReturnValue(Promise.resolve(users))

  jest
    .spyOn(AccountsService.prototype, 'getAccount')
    .mockImplementation(async (userId: string) => {
      return users.find((user) => user.id === userId) as Account
    })
}

describe('Test notifications service', () => {
  test('should send notification on assignments update', async () => {
    const mongoDb = await getMongoDbClient()
    const user1 = 'USER-1'
    const user2 = 'USER-2'

    const tenantId = getTestTenantId()
    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
    })

    const case_ = await caseRepository.addCaseMongo(getTestCase())

    const event = getApiGatewayPatchEvent(tenantId, '/alerts/assignments', {
      alertIds: [case_?.alerts?.[0]?.alertId],
      assignments: [
        {
          assigneeUserId: user2,
          assignedByUserId: user1,
          timestamp: Date.now(),
        },
      ],
    })

    const role: AccountRole = {
      description: 'Admin',
      id: 'ADMIN',
      name: 'Admin',
      permissions: PERMISSIONS,
    }

    const roles: AccountRole[] = [role]

    getContextMocker.mockReturnValue({
      tenantId,
      settings: {
        notificationsSubscriptions: {
          console: ['CASE_ASSIGNMENT', 'ALERT_ASSIGNMENT'],
        },
      },
      features: ['NOTIFICATIONS'],
      user: { id: user1, role: 'Admin' },
    })

    const users: Account[] = [
      { id: user1, email: 'user1@test.com', role: 'Admin' } as Account,
      { id: user2, email: 'user2@test.com', role: 'Admin' } as Account,
    ]

    getSpyes(users, roles)

    await casesHandler(event, null as any, null as any)

    const notificationsService = new NotificationRepository(tenantId, {
      mongoDb,
    })

    const notifications =
      await notificationsService.getNotificationsByRecipient(user2)

    expect(notifications.length).toBe(1)
    expect(notifications[0]?.consoleNotificationStatuses?.[0].status).toBe(
      'SENT'
    )
  })

  test('should not send notification on assignments update if user does not have permission', async () => {
    jest.clearAllMocks()
    const mongoDb = await getMongoDbClient()
    const user1 = 'USER-1'
    const user2 = 'USER-2'

    const tenantId = getTestTenantId()

    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
    })

    const case_ = await caseRepository.addCaseMongo(getTestCase())

    const event = getApiGatewayPatchEvent(tenantId, '/cases/assignments', {
      caseIds: [case_?.caseId],
      assignments: [
        {
          assigneeUserId: user2,
          assignedByUserId: user1,
          timestamp: Date.now(),
        },
      ],
    })

    const role1: AccountRole = {
      description: 'Some role',
      id: 'SOME_ROLE',
      name: 'Some role',
      permissions: ['audit-log:export:read'],
    }

    const role2: AccountRole = {
      description: 'Admin',
      id: 'ADMIN',
      name: 'Admin',
      permissions: PERMISSIONS,
    }

    const roles: AccountRole[] = [role1, role2]

    getContextMocker.mockReturnValue({
      tenantId,
      settings: {
        notificationsSubscriptions: {
          console: ['CASE_ASSIGNMENT', 'ALERT_ASSIGNMENT'],
        },
      },
      features: ['NOTIFICATIONS'],
      user: { id: user1, role: 'Admin' },
    })

    const users: Account[] = [
      { id: user1, email: 'user1@test.com', role: 'Admin' } as Account,
      { id: user2, email: 'user2@test.com', role: 'Some role' } as Account,
    ]

    getSpyes(users, roles)

    await casesHandler(event, null as any, null as any)

    const notificationsService = new NotificationRepository(tenantId, {
      mongoDb,
    })

    const notifications =
      await notificationsService.getNotificationsByRecipient(user2)

    expect(notifications.length).toBe(0)
  })

  test('Send Unassignment notification', async () => {
    const mongoDb = await getMongoDbClient()
    const user = 'USER-1'
    const user2 = 'USER-2'

    const tenantId = getTestTenantId()

    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
    })

    const case_ = await caseRepository.addCaseMongo(
      getTestCase({
        assignments: [
          {
            assigneeUserId: user2,
            assignedByUserId: user,
            timestamp: Date.now(),
          },
        ],
      })
    )

    const event = getApiGatewayPatchEvent(tenantId, '/cases/assignments', {
      caseIds: [case_?.caseId],
      assignments: [],
    })

    const role: AccountRole = {
      description: 'Admin',
      id: 'ADMIN',
      name: 'Admin',
      permissions: PERMISSIONS,
    }

    const roles: AccountRole[] = [role]

    getContextMocker.mockReturnValue({
      tenantId,
      settings: {
        notificationsSubscriptions: {
          console: ['CASE_UNASSIGNMENT'],
        },
      },
      features: ['NOTIFICATIONS'],
      user: { id: user, role: 'Admin' },
    })

    const users: Account[] = [
      { id: user, email: `${user}@test.com`, role: 'Admin' } as Account,
      { id: user2, email: `${user2}@test.com`, role: 'Admin' } as Account,
    ]

    getSpyes(users, roles)

    await casesHandler(event, null as any, null as any)

    const notificationsService = new NotificationRepository(tenantId, {
      mongoDb,
    })

    const notifications =
      await notificationsService.getNotificationsByRecipient(user2)

    expect(notifications.length).toBe(1)
    expect(notifications[0]?.consoleNotificationStatuses?.[0].status).toBe(
      'SENT'
    )
    expect(notifications[0]?.notificationType).toBe('CASE_UNASSIGNMENT')
    expect(notifications[0]?.recievers).toContain(user2)
  })

  test('Send Case Escalation notification', async () => {
    const mongoDb = await getMongoDbClient()
    const user = 'USER-1'
    const user2 = 'USER-2'

    const tenantId = getTestTenantId()

    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
    })

    const case_ = await caseRepository.addCaseMongo(
      getTestCase({
        caseStatus: 'OPEN',
      })
    )

    const requestBody: CaseEscalationRequest = {
      caseUpdateRequest: {
        reason: ['False positive'],
        comment: 'Escalating case',
        caseStatus: 'ESCALATED',
      },
    }

    const event = getApiGatewayPostEvent(
      tenantId,
      `/cases/{caseId}/escalate`,
      requestBody,
      {
        pathParameters: {
          caseId: case_?.caseId as string,
        },
      }
    )

    const role: AccountRole = {
      description: 'Admin',
      id: 'ADMIN',
      name: 'Admin',
      permissions: PERMISSIONS,
    }

    const roles: AccountRole[] = [role]

    const users: Account[] = [
      {
        id: user,
        email: `${user}@test.com`,
        role: 'Admin',
        isEscalationContact: false,
      } as Account,
      {
        id: user2,
        email: `${user2}@test.com`,
        role: 'Admin',
        isEscalationContact: true,
      } as Account,
    ]

    getContextMocker.mockReturnValue({
      tenantId,
      settings: {
        notificationsSubscriptions: {
          console: ['CASE_ESCALATION'],
        },
      },
      features: ['NOTIFICATIONS', 'ADVANCED_WORKFLOWS'],
      user: users[0],
    })

    getSpyes(users, roles)

    await casesHandler(event, null as any, null as any)

    const case_1 = await caseRepository.getCaseById(case_?.caseId as string)
    const notificationsService = new NotificationRepository(tenantId, {
      mongoDb,
    })

    const notifications =
      await notificationsService.getNotificationsByRecipient(user2)

    expect(notifications.length).toBe(1)
    expect(notifications[0]?.consoleNotificationStatuses?.[0].status).toBe(
      'SENT'
    )
    expect(notifications[0]?.notificationType).toBe('CASE_ESCALATION')
    expect(notifications[0]?.recievers).toContain(user2)
    expect(case_1?.caseStatus).toBe('ESCALATED')
  })

  test('Send Alert Escalation notification', async () => {
    const mongoDb = await getMongoDbClient()
    const user = 'USER-1'
    const user2 = 'USER-2'

    const tenantId = getTestTenantId()

    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
    })

    const case_ = await caseRepository.addCaseMongo(
      getTestCase({
        caseStatus: 'OPEN',
        alerts: [
          {
            alertId: `A-${Date.now()}`,
            alertStatus: 'OPEN',
            assignments: [],
            createdTimestamp: Date.now(),
            numberOfTransactionsHit: 0,
            priority: 'P1',
            ruleAction: 'ALLOW',
            ruleDescription: 'Test rule',
            ruleInstanceId: `R-${Date.now()}`,
            ruleName: 'Test rule',
            transactionIds: ['T-1', 'T-2', 'T-3'],
          },
        ],
      })
    )

    const requestBody = {
      caseUpdateRequest: {
        reason: ['Anti-money laundering'],
        comment: 'Test',
        files: [],
      },
      alertEscalations: [
        {
          alertId: case_?.alerts?.[0]?.alertId,
          transactionIds: ['T-1', 'T-2'],
        },
      ],
      closeSourceCase: false,
    }

    const event = getApiGatewayPostEvent(
      tenantId,
      `/cases/{caseId}/escalate`,
      requestBody,
      {
        pathParameters: {
          caseId: case_?.caseId as string,
        },
      }
    )

    const role: AccountRole = {
      description: 'Admin',
      id: 'ADMIN',
      name: 'Admin',
      permissions: PERMISSIONS,
    }

    const roles: AccountRole[] = [role]

    const users: Account[] = [
      {
        id: user,
        email: `${user}@test.com`,
        isEscalationContact: false,
        role: 'Admin',
      } as Account,
      {
        id: user2,
        email: `${user2}@test.com`,
        isEscalationContact: true,
        role: 'Admin',
      } as Account,
    ]

    getContextMocker.mockReturnValue({
      tenantId,
      settings: {
        notificationsSubscriptions: {
          console: ['ALERT_ESCALATION'],
        },
      },
      features: ['NOTIFICATIONS', 'ADVANCED_WORKFLOWS'],
      user: users[0],
    })

    getSpyes(users, roles)

    await casesHandler(event, null as any, null as any)

    const case_1 = await caseRepository.getCaseById(`${case_?.caseId}.1`)
    const notificationsService = new NotificationRepository(tenantId, {
      mongoDb,
    })

    const notifications =
      await notificationsService.getNotificationsByRecipient(user2)

    expect(notifications.length).toBe(1)
    expect(notifications[0]?.consoleNotificationStatuses?.[0].status).toBe(
      'SENT'
    )
    expect(notifications[0]?.notificationType).toBe('ALERT_ESCALATION')
    expect(notifications[0]?.recievers).toContain(user2)
    expect(case_1?.caseStatus).toBe('ESCALATED')
    expect(case_1?.alerts?.[0]?.alertStatus).toBe('ESCALATED')

    const originalCase = await caseRepository.getCaseById(
      case_?.caseId as string
    )

    expect(originalCase?.caseStatus).toBe('OPEN')
  })
  test('Send mentions notification for case', async () => {
    const mongoDb = await getMongoDbClient()
    const user = 'auth0|user1'
    const user2 = 'auth0|user2'

    const tenantId = getTestTenantId()

    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
    })

    const case_ = await caseRepository.addCaseMongo(
      getTestCase({
        comments: [],
      })
    )
    const event = getApiGatewayPostEvent(
      tenantId,
      `/cases/{caseId}/comments`,
      {
        body: 'Test comment for [@user1](auth0|user1) and [@user2](auth0|user2)',
        files: [],
      },
      {
        pathParameters: {
          caseId: case_?.caseId as string,
        },
      }
    )
    const role: AccountRole = {
      description: 'Admin',
      id: 'ADMIN',
      name: 'Admin',
      permissions: PERMISSIONS,
    }
    const roles: AccountRole[] = [role]

    getContextMocker.mockReturnValue({
      tenantId,
      settings: {
        notificationsSubscriptions: {
          console: ['CASE_COMMENT_MENTION'],
        },
      },
      features: ['NOTIFICATIONS'],
      user: { id: user, role: 'Admin' },
    })

    const users: Account[] = [
      { id: user, email: `${user}@test.com`, role: 'Admin' } as Account,
      { id: user2, email: `${user2}@test.com`, role: 'Admin' } as Account,
    ]

    getSpyes(users, roles)

    await casesHandler(event, null as any, null as any)

    const notificationsService = new NotificationRepository(tenantId, {
      mongoDb,
    })

    const notifications =
      await notificationsService.getNotificationsByRecipient(user2)

    const sendersNotifications =
      await notificationsService.getNotificationsByRecipient(user)
    expect(notifications.length).toBe(1)
    expect(sendersNotifications.length).toBe(0)
    expect(notifications[0]?.consoleNotificationStatuses?.[0].status).toBe(
      'SENT'
    )
    expect(notifications[0]?.notificationType).toBe('CASE_COMMENT_MENTION')
    expect(notifications[0]?.recievers).toContain(user2)
  })
  test('Send mentions notification for user', async () => {
    const mongoDb = await getMongoDbClient()
    const user = 'auth0|user1'
    const user2 = 'auth0|user2'

    const tenantId = getTestTenantId()

    const userRepository = new UserRepository(tenantId, {
      dynamoDb: getDynamoDbClient(),
      mongoDb,
    })

    const savedUser = await userRepository.saveUser(
      getTestUser({
        comments: [],
      }),
      'CONSUMER'
    )
    const event = getApiGatewayPostEvent(
      tenantId,
      `/users/{userId}/comments`,
      {
        body: 'Test comment for [@user1](auth0|user1) and [@user2](auth0|user2)',
        files: [],
      },
      {
        pathParameters: {
          userId: savedUser?.userId as string,
        },
      }
    )
    const role: AccountRole = {
      description: 'Admin',
      id: 'ADMIN',
      name: 'Admin',
      permissions: PERMISSIONS,
    }
    const roles: AccountRole[] = [role]

    getContextMocker.mockReturnValue({
      tenantId,
      settings: {
        notificationsSubscriptions: {
          console: ['USER_COMMENT_MENTION'],
        },
      },
      features: ['NOTIFICATIONS'],
      user: { id: user, role: 'Admin' },
    })

    const users: Account[] = [
      { id: user, email: `${user}@test.com`, role: 'Admin' } as Account,
      { id: user2, email: `${user2}@test.com`, role: 'Admin' } as Account,
    ]

    getSpyes(users, roles)

    await allUsersViewHandler(event, null as any, null as any)

    const notificationsService = new NotificationRepository(tenantId, {
      mongoDb,
    })

    const notifications =
      await notificationsService.getNotificationsByRecipient(user2)

    const sendersNotifications =
      await notificationsService.getNotificationsByRecipient(user)
    expect(notifications.length).toBe(1)
    expect(sendersNotifications.length).toBe(0)
    expect(notifications[0]?.consoleNotificationStatuses?.[0].status).toBe(
      'SENT'
    )
    expect(notifications[0]?.notificationType).toBe('USER_COMMENT_MENTION')
    expect(notifications[0]?.recievers).toContain(user2)
  })

  test('Send in review notification for case', async () => {
    const mongoDb = await getMongoDbClient()
    const user = 'USER-1'
    const user2 = 'USER-2'

    const tenantId = getTestTenantId()

    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
    })

    const case_ = await caseRepository.addCaseMongo(
      getTestCase({
        caseStatus: 'OPEN',
      })
    )

    const event = getApiGatewayPatchEvent(tenantId, '/cases/statusChange', {
      caseIds: [case_?.caseId as string],
      updates: {
        reason: ['Investigation completed'],
        caseStatus: 'CLOSED',
        comment: 'Test',
        files: [],
      },
    })

    const role: AccountRole = {
      description: 'Admin',
      id: 'ADMIN',
      name: 'Admin',
      permissions: PERMISSIONS,
    }

    const roles: AccountRole[] = [role]

    const users: Account[] = [
      {
        id: user,
        email: `${user}@gmail.com`,
        role: 'Admin',
        reviewerId: user2,
      } as Account,
      {
        id: user2,
        email: `${user2}@gmail.com`,
        role: 'Admin',
      } as Account,
    ]

    getContextMocker.mockReturnValue({
      tenantId,
      settings: {
        notificationsSubscriptions: {
          console: ['CASE_IN_REVIEW'],
        },
      },
      features: ['NOTIFICATIONS', 'ADVANCED_WORKFLOWS'],
      user: users[0],
    })

    getSpyes(users, roles)

    await casesHandler(event, null as any, null as any)

    const notificationsService = new NotificationRepository(tenantId, {
      mongoDb,
    })

    const notifications =
      await notificationsService.getNotificationsByRecipient(user2)

    expect(notifications.length).toBe(1)
    expect(notifications[0]?.consoleNotificationStatuses?.[0].status).toBe(
      'SENT'
    )
    expect(notifications[0]?.notificationType).toBe('CASE_IN_REVIEW')
    expect(notifications[0]?.recievers).toContain(user2)
  })

  test('Send in review notification for alert', async () => {
    const mongoDb = await getMongoDbClient()
    const user = 'USER-1'
    const user2 = 'USER-2'

    const tenantId = getTestTenantId()

    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
    })

    const case_ = await caseRepository.addCaseMongo(
      getTestCase({
        caseStatus: 'OPEN',
        alerts: [
          {
            alertId: `A-${Date.now()}`,
            alertStatus: 'OPEN',
            assignments: [],
            createdTimestamp: Date.now(),
            numberOfTransactionsHit: 0,
            priority: 'P1',
            ruleAction: 'ALLOW',
            ruleDescription: 'Test rule',
            ruleInstanceId: `R-${Date.now()}`,
            ruleName: 'Test rule',
          },
        ],
      })
    )

    const event = getApiGatewayPatchEvent(tenantId, '/alerts/statusChange', {
      alertIds: [case_?.alerts?.[0]?.alertId as string],
      updates: {
        reason: ['Investigation completed'],
        alertStatus: 'CLOSED',
        comment: 'Test',
        files: [],
      },
    })

    const role: AccountRole = {
      description: 'Admin',
      id: 'ADMIN',
      name: 'Admin',
      permissions: PERMISSIONS,
    }

    const roles: AccountRole[] = [role]

    const users: Account[] = [
      {
        id: user,
        email: `${user}@test.com`,
        role: 'Admin',
        reviewerId: user2,
      } as Account,
      {
        id: user2,
        email: `${user2}@test.com`,
        role: 'Admin',
      } as Account,
    ]

    getContextMocker.mockReturnValue({
      tenantId,
      settings: {
        notificationsSubscriptions: {
          console: ['ALERT_IN_REVIEW'],
        },
      },
      features: ['NOTIFICATIONS', 'ADVANCED_WORKFLOWS'],
      user: users[0],
    })

    getSpyes(users, roles)

    await casesHandler(event, null as any, null as any)

    const notificationsService = new NotificationRepository(tenantId, {
      mongoDb,
    })

    const notifications =
      await notificationsService.getNotificationsByRecipient(user2)

    expect(notifications.length).toBe(1)
    expect(notifications[0]?.consoleNotificationStatuses?.[0].status).toBe(
      'SENT'
    )
    expect(notifications[0]?.notificationType).toBe('ALERT_IN_REVIEW')
    expect(notifications[0]?.recievers).toContain(user2)
    expect(notifications[0]?.notificationData?.status).toBe('IN_REVIEW_CLOSED')
  })

  test('Send comment notification for case', async () => {
    const mongoDb = await getMongoDbClient()
    const user = 'USER-1'
    const user2 = 'USER-2'

    const tenantId = getTestTenantId()

    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
    })

    const case_ = await caseRepository.addCaseMongo(
      getTestCase({
        assignments: [
          {
            assigneeUserId: user2,
            assignedByUserId: user,
            timestamp: Date.now(),
          },
        ],
      })
    )

    const event = getApiGatewayPostEvent(
      tenantId,
      `/cases/{caseId}/comments`,
      {
        body: 'Test comment',
        files: [],
      },
      {
        pathParameters: {
          caseId: case_?.caseId as string,
        },
      }
    )

    const role: AccountRole = {
      description: 'Admin',
      id: 'ADMIN',
      name: 'Admin',
      permissions: PERMISSIONS,
    }

    const roles: AccountRole[] = [role]

    const users: Account[] = [
      { id: user, email: `${user}@test.com`, role: 'Admin' } as Account,
      { id: user2, email: `${user2}@test.com`, role: 'Admin' } as Account,
    ]

    getContextMocker.mockReturnValue({
      tenantId,
      settings: {
        notificationsSubscriptions: {
          console: ['CASE_COMMENT'],
        },
      },
      features: ['NOTIFICATIONS'],
      user: { id: user, role: 'Admin' },
    })

    getSpyes(users, roles)

    await casesHandler(event, null as any, null as any)

    const notificationsService = new NotificationRepository(tenantId, {
      mongoDb,
    })

    const notifications =
      await notificationsService.getNotificationsByRecipient(user2)

    expect(notifications.length).toBe(1)
  })

  test('Case update notification', async () => {
    const mongoDb = await getMongoDbClient()
    const user = 'USER-1'
    const user2 = 'USER-2'

    const tenantId = getTestTenantId()

    const caseRepository = new CaseRepository(tenantId, {
      mongoDb,
    })

    const case_ = await caseRepository.addCaseMongo(
      getTestCase({
        assignments: [
          {
            assigneeUserId: user2,
            assignedByUserId: user,
            timestamp: Date.now(),
          },
        ],
      })
    )

    const event = getApiGatewayPatchEvent(tenantId, '/cases/statusChange', {
      caseIds: [case_?.caseId as string],
      updates: {
        reason: ['Investigation completed'],
        caseStatus: 'CLOSED',
        comment: 'Test',
        files: [],
      },
    })

    const role: AccountRole = {
      description: 'Admin',
      id: 'ADMIN',
      name: 'Admin',
      permissions: PERMISSIONS,
    }

    const roles: AccountRole[] = [role]

    const users: Account[] = [
      { id: user, email: `${user}@test.com`, role: 'Admin' } as Account,
      { id: user2, email: `${user2}@test.com`, role: 'Admin' } as Account,
    ]

    getContextMocker.mockReturnValue({
      tenantId,
      settings: {
        notificationsSubscriptions: {
          console: ['CASE_STATUS_UPDATE'],
        },
      },
      features: ['NOTIFICATIONS'],
      user: { id: user, role: 'Admin' },
    })

    getSpyes(users, roles)

    await casesHandler(event, null as any, null as any)

    const notificationsService = new NotificationRepository(tenantId, {
      mongoDb,
    })

    const notifications =
      await notificationsService.getNotificationsByRecipient(user2)

    expect(notifications.length).toBe(1)
    expect(notifications[0]?.consoleNotificationStatuses?.[0].status).toBe(
      'SENT'
    )
    expect(notifications[0]?.notificationType).toBe('CASE_STATUS_UPDATE')
    expect(notifications[0]?.recievers).toContain(user2)
    expect(notifications[0]?.notificationData?.status).toBe('CLOSED')
    expect(notifications[0]?.notificationData?.type).toBe('UPDATE')
  })
})

const getTestNotification = (payload: Partial<Notification>): Notification => {
  return {
    createdAt: Date.now(),
    id: 'test-id',
    notificationChannel: 'CONSOLE',
    notificationType: 'ALERT_ASSIGNMENT',
    recievers: ['test-account'],
    entityId: 'test-entity-id',
    entityType: 'ALERT',
    triggeredBy: 'test-triggered-by',
    notificationData: {},
    consoleNotificationStatuses: [
      {
        recieverUserId: 'test-account',
        status: 'SENT',
        stausUpdatedAt: Date.now(),
      },
    ],
    ...payload,
  }
}

describe('Console Notifications Service Tests', () => {
  test('Mark all as read', async () => {
    jest.clearAllMocks()
    const mongoDb = await getMongoDbClient()
    const testTenantId = getTestTenantId()
    const notificationsRepository = new NotificationRepository(testTenantId, {
      mongoDb,
    })

    const notificationsService = new ConsoleNotifications(testTenantId, {
      mongoDb,
    })

    const accountId = 'test-account'
    const account2Id = 'test-account-2'

    await notificationsRepository.addNotification(
      getTestNotification({
        recievers: [accountId, account2Id],
        consoleNotificationStatuses: [
          {
            recieverUserId: accountId,
            status: 'SENT',
            stausUpdatedAt: Date.now(),
          },
          {
            recieverUserId: account2Id,
            status: 'SENT',
            stausUpdatedAt: Date.now(),
          },
        ],
      })
    )

    await notificationsService.markAllAsRead(accountId)

    const { items: notifications } =
      await notificationsService.getConsoleNotifications(accountId, {
        notificationStatus: 'ALL',
      })

    expect(notifications.length).toBe(1)
    expect(notifications?.[0]?.consoleNotificationStatuses?.[0]?.status).toBe(
      'READ'
    )
    expect(notifications?.[0]?.recievers?.length).toBe(1)
  })

  test('Mark as read', async () => {
    const mongoDb = await getMongoDbClient()
    const testTenantId = getTestTenantId()
    const notificationsRepository = new NotificationRepository(testTenantId, {
      mongoDb,
    })
    const notificationsService = new ConsoleNotifications(testTenantId, {
      mongoDb,
    })

    const accountId = 'test-account'
    const account2Id = 'test-account-2'

    const notification = await notificationsRepository.addNotification(
      getTestNotification({
        recievers: [accountId, account2Id],
        consoleNotificationStatuses: [
          {
            recieverUserId: accountId,
            status: 'SENT',
            stausUpdatedAt: Date.now(),
          },
          {
            recieverUserId: account2Id,
            status: 'SENT',
            stausUpdatedAt: Date.now(),
          },
        ],
      })
    )

    await notificationsService.markAsRead(accountId, notification.id)

    const { items: notificationsAfterMarkAsRead } =
      await notificationsService.getConsoleNotifications(accountId, {
        notificationStatus: 'ALL',
      })

    expect(notificationsAfterMarkAsRead.length).toBe(1)
    expect(
      notificationsAfterMarkAsRead?.[0]?.consoleNotificationStatuses?.[0]
        ?.status
    ).toBe('READ')
    expect(notificationsAfterMarkAsRead?.[0]?.recievers?.length).toBe(1)
  })
})
