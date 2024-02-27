import { NotificationRepository } from '../notifications-repository'
import { casesHandler } from '@/lambdas/console-api-case/app'
import { CaseRepository } from '@/services/rules-engine/repositories/case-repository'
import { getApiGatewayPatchEvent } from '@/test-utils/apigateway-test-utils'
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

dynamoDbSetupHook()
withFeatureHook(['NOTIFICATIONS'])

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
})
