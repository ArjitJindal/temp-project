import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { sortBy } from 'lodash'
import * as createError from 'http-errors'
import { ActiveSession, SessionsRepository } from './repository'
import { getContext } from '@/core/utils/context-storage'

export class SessionsService {
  private readonly repository: SessionsRepository

  constructor(tenantId: string, dynamoDb: DynamoDBDocumentClient) {
    this.repository = new SessionsRepository(tenantId, dynamoDb)
  }

  async refreshActiveSessions(
    userId: string,
    deviceInfo: { userAgent: string; deviceFingerprint: string }
  ): Promise<void> {
    const maxActiveSessions = getContext()?.settings?.maxActiveSessions
    if (!maxActiveSessions) {
      return
    }
    const activeSessions = await this.getActiveSessions(userId)
    if (activeSessions.length >= maxActiveSessions) {
      const sortedActiveSessions = sortBy(activeSessions, 'createdAt')
      const sessionsToDelete = sortedActiveSessions.slice(
        0,
        activeSessions.length - maxActiveSessions + 1
      )

      await Promise.all(
        sessionsToDelete.map((sessionToDelete) =>
          this.repository.deleteActiveSession(sessionToDelete)
        )
      )
    }
    await this.repository.createActiveSession(userId, deviceInfo)
  }

  async validateActiveSession(
    userId: string,
    deviceInfo: { userAgent: string; deviceFingerprint: string }
  ): Promise<void> {
    const maxActiveSessions = getContext()?.settings?.maxActiveSessions
    if (!maxActiveSessions) {
      return
    }
    const result = await this.repository.getActiveSession(userId, deviceInfo)

    if (!result) {
      // Getting active sessions is needed when an admin user updates the max active sessions config
      const activeSessions = await this.getActiveSessions(userId)

      if (activeSessions.length + 1 > maxActiveSessions) {
        throw new createError.Unauthorized('Invalid session')
      }
    }
  }

  public async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    return this.repository.getActiveSessions(userId)
  }
}
