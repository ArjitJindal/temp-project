import { Unauthorized } from 'http-errors'
import { withContext } from '@/core/utils/context'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import { SessionsService } from '@/services/sessions'

dynamoDbSetupHook()

describe('AccountsService', () => {
  let sessionsService: SessionsService

  beforeEach(async () => {
    sessionsService = new SessionsService('tenant1', getDynamoDbClient())
  })

  describe('refreshActiveSessions', () => {
    it('should refresh active sessions and delete old ones if limit is reached', async () => {
      const userId = 'user1'

      await withContext(
        async () => {
          await sessionsService.refreshActiveSessions(userId, {
            userAgent: 'test-agent',
            deviceFingerprint: 'test-fingerprint',
          })
          const activeSessions1 = await sessionsService.getActiveSessions(
            userId
          )
          expect(activeSessions1.length).toBe(1)
          await sessionsService.refreshActiveSessions(userId, {
            userAgent: 'test-agent-2',
            deviceFingerprint: 'test-fingerprint-2',
          })
          const activeSessions2 = await sessionsService.getActiveSessions(
            userId
          )
          expect(activeSessions2.length).toBe(2)
          await sessionsService.refreshActiveSessions(userId, {
            userAgent: 'test-agent-3',
            deviceFingerprint: 'test-fingerprint-3',
          })
          const activeSessions3 = await sessionsService.getActiveSessions(
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
      const userId = 'user1'
      const deviceInfo = {
        userAgent: 'test-agent',
        deviceFingerprint: 'test-fingerprint',
      }

      await withContext(
        async () => {
          await sessionsService.refreshActiveSessions(userId, deviceInfo)
          await expect(
            sessionsService.validateActiveSession(userId, deviceInfo)
          ).resolves.not.toThrow()
        },
        { settings: { maxActiveSessions: 2 } }
      )
    })
    it('should throw Unauthorized error if session is invalid and max sessions reached', async () => {
      const userId = 'user1'
      const deviceInfo = {
        userAgent: 'test-agent',
        deviceFingerprint: 'test-fingerprint',
      }

      await withContext(
        async () => {
          await sessionsService.refreshActiveSessions(userId, deviceInfo)
          await expect(
            sessionsService.validateActiveSession(userId, {
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
            sessionsService.validateActiveSession('user1', {
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
