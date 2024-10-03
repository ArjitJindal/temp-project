import { Unauthorized } from 'http-errors'
import { AccountsService } from '../index'
import { withContext } from '@/core/utils/context'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()

describe('AccountsService', () => {
  let accountsService: AccountsService

  beforeEach(async () => {
    accountsService = new AccountsService(
      { auth0Domain: 'test.auth0.com' },
      { mongoDb: await getMongoDbClient(), dynamoDb: getDynamoDbClient() }
    )
  })

  describe('refreshActiveSessions', () => {
    it('should refresh active sessions and delete old ones if limit is reached', async () => {
      const tenantId = 'tenant1'
      const userId = 'user1'

      await withContext(
        async () => {
          await accountsService.refreshActiveSessions(tenantId, userId, {
            userIp: '127.0.0.1',
            userAgent: 'test-agent',
            deviceFingerprint: 'test-fingerprint',
          })
          const activeSessions1 = await accountsService.getActiveSessions(
            tenantId,
            userId
          )
          expect(activeSessions1.length).toBe(1)
          await accountsService.refreshActiveSessions(tenantId, userId, {
            userIp: '127.0.0.1',
            userAgent: 'test-agent-2',
            deviceFingerprint: 'test-fingerprint-2',
          })
          const activeSessions2 = await accountsService.getActiveSessions(
            tenantId,
            userId
          )
          expect(activeSessions2.length).toBe(2)
          await accountsService.refreshActiveSessions(tenantId, userId, {
            userIp: '127.0.0.1',
            userAgent: 'test-agent-3',
            deviceFingerprint: 'test-fingerprint-3',
          })
          const activeSessions3 = await accountsService.getActiveSessions(
            tenantId,
            userId
          )
          expect(activeSessions3.length).toBe(2)
          expect(activeSessions3.map((v) => v.userAgent)).toEqual(
            expect.arrayContaining(['test-agent-2', 'test-agent-3'])
          )
        },
        { settings: { maxActiveSessions: 2 } }
      )
    })
  })

  describe('validateActiveSession', () => {
    it('should not throw an error if session is valid', async () => {
      const tenantId = 'tenant1'
      const userId = 'user1'
      const deviceInfo = {
        userIp: '127.0.0.1',
        userAgent: 'test-agent',
        deviceFingerprint: 'test-fingerprint',
      }

      await withContext(
        async () => {
          await accountsService.refreshActiveSessions(
            tenantId,
            userId,
            deviceInfo
          )
          await expect(
            accountsService.validateActiveSession(tenantId, userId, deviceInfo)
          ).resolves.not.toThrow()
        },
        { settings: { maxActiveSessions: 2 } }
      )
    })
    it('should throw Unauthorized error if session is invalid and max sessions reached', async () => {
      const tenantId = 'tenant1'
      const userId = 'user1'
      const deviceInfo = {
        userIp: '127.0.0.1',
        userAgent: 'test-agent',
        deviceFingerprint: 'test-fingerprint',
      }

      await withContext(
        async () => {
          await accountsService.refreshActiveSessions(
            tenantId,
            userId,
            deviceInfo
          )
          await expect(
            accountsService.validateActiveSession(tenantId, userId, {
              userIp: deviceInfo.userIp,
              userAgent: 'test-agent-new',
              deviceFingerprint: 'test-fingerprint-new',
            })
          ).rejects.toThrow(Unauthorized)
        },
        { settings: { maxActiveSessions: 1 } }
      )
    })
    it('should not throw an error if session is invalid but max sessions not reached', async () => {
      await withContext(
        async () => {
          await expect(
            accountsService.validateActiveSession('tenant1', 'user1', {
              userIp: '127.0.0.1',
              userAgent: 'test-agent',
              deviceFingerprint: 'test-fingerprint',
            })
          ).resolves.not.toThrow()
        },
        { settings: { maxActiveSessions: 1 } }
      )
    })
  })
})
