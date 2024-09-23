import { has } from 'lodash'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { publishAuditLog } from '@/services/audit-log'
import { AuditLogActionEnum } from '@/@types/openapi-internal/AuditLogActionEnum'
import { traceable } from '@/core/xray'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { Comment } from '@/@types/openapi-internal/Comment'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { UserTag } from '@/@types/openapi-internal/UserTag'

@traceable
export class UserAuditLogService {
  tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  public async handleAuditLogForUserViewed(userId: string): Promise<void> {
    await this.createAuditLog(userId, 'VIEW')
  }
  public async handleAuditLogForUserUpdate(
    updateRequest: UserUpdateRequest,
    userId: string
  ): Promise<void> {
    const auditLog: AuditLog = {
      type: 'USER',
      action: 'UPDATE',
      timestamp: Date.now(),
      newImage: updateRequest,
      entityId: userId,
      subtype: has(updateRequest, 'userStateDetails')
        ? 'USER_STATUS_CHANGE'
        : 'USER_KYC_STATUS_CHANGE',
    }
    await publishAuditLog(this.tenantId, auditLog)
  }

  public async handleAuditLogForAddComment(
    userId: string,
    comment: Comment
  ): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const userRepository = new UserRepository(this.tenantId, {
      mongoDb: mongoDb,
      dynamoDb: getDynamoDbClient(),
    })
    const user = await userRepository.getUserById(userId)
    const auditLog: AuditLog = {
      type: 'USER',
      subtype: 'COMMENT',
      action: 'CREATE',
      timestamp: Date.now(),
      newImage: comment,
      entityId: userId,
      logMetadata: {
        userType: user?.type,
      },
    }
    await publishAuditLog(this.tenantId, auditLog)
  }

  public async handleAuditLogForTagsUpdate(
    userId: string,
    tags: UserTag[]
  ): Promise<void> {
    const auditLog: AuditLog = {
      type: 'USER',
      action: 'UPDATE',
      timestamp: Date.now(),
      newImage: { tags },
      entityId: userId,
      subtype: 'TAGS_UPDATE',
    }
    await publishAuditLog(this.tenantId, auditLog)
  }

  public async handleAuditLogForDeleteComment(
    userId: string,
    comment: Comment
  ): Promise<void> {
    const mongoDb = await getMongoDbClient()
    const userRepository = new UserRepository(this.tenantId, {
      mongoDb: mongoDb,
      dynamoDb: getDynamoDbClient(),
    })
    const user = await userRepository.getUserById(userId)
    const auditLog: AuditLog = {
      type: 'USER',
      subtype: 'COMMENT',
      action: 'DELETE',
      timestamp: Date.now(),
      oldImage: comment,
      newImage: {},
      entityId: userId,
      logMetadata: {
        userType: user?.type,
      },
    }
    await publishAuditLog(this.tenantId, auditLog)
  }

  private async createAuditLog(userId: string, logAction: AuditLogActionEnum) {
    const auditLog: AuditLog = {
      type: 'USER',
      action: logAction,
      timestamp: Date.now(),
      entityId: userId,
    }
    await publishAuditLog(this.tenantId, auditLog)
  }
}
