import { MongoClient } from 'mongodb'
import compact from 'lodash/compact'
import memoize from 'lodash/memoize'
import { v4 as uuid } from 'uuid'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { hasResources, Resource } from '@flagright/lib/utils'
import { ApprovalWorkflowMachine } from '@flagright/lib/classes/workflow-machine'
import { ApprovalWorkflow } from '@flagright/lib/@types/workflow'
import { AccountsService } from '../accounts'
import { RoleService } from '../roles'
import { NotificationsChannels } from './notifications-channels'
import { ConsoleNotifications } from './console-notifications'
import { NotificationRepository } from './notifications-repository'
import { AlertAssignees } from './subscriptions/alert-assignment'
import { CaseAssignees } from './subscriptions/case-assignments'
import { Subscriptions } from './subscriptions'
import { CaseUnassignment } from './subscriptions/case-unassignment'
import { AlertUnassignment } from './subscriptions/alert-unassignment'
import { CaseEscalation } from './subscriptions/case-escalation'
import { AlertEscalations } from './subscriptions/alert-escalation'
import { AlertCommentMention } from './subscriptions/alert-comment-mention'
import { CaseCommentMention } from './subscriptions/case-comment-mention'
import { UserCommentMention } from './subscriptions/user-comment-mention'
import { AlertInReview } from './subscriptions/alert-in-review'
import { CaseInReview } from './subscriptions/case-in-review'
import { CaseComment } from './subscriptions/alert-comment'
import { AlertComment } from './subscriptions/case-comment'
import { AlertStatusUpdate } from './subscriptions/alert-status-update'
import { CaseStatusUpdate } from './subscriptions/case-status-update'
import { RiskClassificationApproval } from './subscriptions/risk-classification-approval'
import { RiskFactorsApproval } from './subscriptions/risk-factors-approval'
import { UserChangesApproval } from './subscriptions/user-changes-approval'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { Notification } from '@/@types/openapi-internal/Notification'
import { traceable } from '@/core/xray'
import { NotificationType } from '@/@types/openapi-internal/NotificationType'
import { AccountRole } from '@/@types/openapi-internal/AccountRole'
import {
  NotificationRawPayload,
  PartialNotification,
} from '@/@types/notifications'
import { Account } from '@/@types/openapi-internal/Account'
import { WorkflowService } from '@/services/workflow'
import { WorkflowRef } from '@/@types/openapi-internal/WorkflowRef'

@traceable
export class NotificationsService {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.mongoDb = connections.mongoDb
    this.dynamoDb = connections.dynamoDb
  }

  private allUsers = memoize(async () => {
    const accountsService = AccountsService.getInstance(this.dynamoDb, true)
    const tenant = await accountsService.getTenantById(this.tenantId)
    if (!tenant) {
      throw new Error(`Tenant not found: ${this.tenantId}`)
    }
    return accountsService.getTenantAccounts(tenant)
  })

  private rolesService = memoize(() => RoleService.getInstance(this.dynamoDb))

  private allRoles = memoize(
    async () => await this.rolesService().getTenantRoles(this.tenantId)
  )

  private roleById = memoize(
    async (roleId: string) => await this.rolesService().getRole(roleId),
    (roleId) => roleId
  )

  private async getAllUsers(): Promise<Account[]> {
    return await this.allUsers()
  }

  private async getAllRoles(): Promise<AccountRole[]> {
    return await this.allRoles()
  }

  private async getRoleById(roleId: string): Promise<AccountRole> {
    return await this.roleById(roleId)
  }

  private async getNotifications(
    payload: NotificationRawPayload
  ): Promise<PartialNotification[]> {
    const notifications: PartialNotification[] = []

    const subscriptions: Subscriptions[] = [
      new AlertAssignees(),
      new CaseAssignees(),
      new CaseUnassignment(),
      new AlertUnassignment(),
      new CaseEscalation(),
      new AlertEscalations(),
      new AlertCommentMention(),
      new CaseCommentMention(),
      new UserCommentMention(),
      new CaseInReview(),
      new AlertInReview(),
      new CaseComment(),
      new AlertComment(),
      new AlertStatusUpdate(),
      new CaseStatusUpdate(),
      new RiskClassificationApproval(),
      new RiskFactorsApproval(),
      new UserChangesApproval(),
    ]

    // Mapping from notification type to entity type for approval notifications
    const approvalNotificationMap: Record<
      string,
      'RISK_LEVELS' | 'RISK_FACTORS' | 'USER'
    > = {
      RISK_CLASSIFICATION_APPROVAL: 'RISK_LEVELS',
      RISK_FACTORS_APPROVAL: 'RISK_FACTORS',
      USER_CHANGES_APPROVAL: 'USER',
    }

    for (const subscription of subscriptions) {
      if (await subscription.toSend(payload)) {
        const notification = await subscription.getNotification(payload)
        if (notification) {
          // Check if this is an approval notification that needs enhancement
          const entityType =
            approvalNotificationMap[notification.notificationType]

          if (entityType) {
            // Enhance approval notification with workflow information
            const enhancedNotification = await this.enhanceApprovalNotification(
              notification,
              payload as NotificationRawPayload<any>,
              entityType
            )
            if (enhancedNotification) {
              notifications.push(enhancedNotification)
            }
          } else {
            // Non-approval notification, add as-is
            notifications.push(notification)
          }
        }
      }
    }

    return notifications
  }

  /**
   * Generic method to enhance approval notifications for any approval type
   * Handles risk classification, risk factors, and user changes approvals
   *
   * This method:
   * 1. Fetches the workflow definition from the approval's workflowRef
   * 2. Uses ApprovalWorkflowMachine to determine the next step role
   * 3. Finds all users with that role
   * 4. Returns an enhanced notification with the recipient list
   */
  private async enhanceApprovalNotification<
    T extends { workflowRef?: WorkflowRef; approvalStep?: number }
  >(
    notification: PartialNotification,
    payload: NotificationRawPayload<T>,
    entityType: 'RISK_LEVELS' | 'RISK_FACTORS' | 'USER'
  ): Promise<PartialNotification | undefined> {
    const approval = payload.newImage
    if (!approval?.workflowRef) {
      return
    }

    // Get the workflow definition to determine the next step role
    const workflowService = new WorkflowService(this.tenantId, {
      dynamoDb: this.dynamoDb,
      mongoDb: this.mongoDb,
    })

    const workflow = await workflowService.getWorkflowVersion(
      'change-approval',
      approval.workflowRef.id,
      approval.workflowRef.version
    )

    const workflowMachine = new ApprovalWorkflowMachine(
      workflow as ApprovalWorkflow
    )

    // Get the next step in the approval chain (default to 0 if not provided)
    const pendingStep = workflowMachine.getApprovalStep(
      approval.approvalStep ?? 0
    )

    // Get users with the required role for the next step
    const roleService = RoleService.getInstance(this.dynamoDb)
    const accountsService = AccountsService.getInstance(this.dynamoDb)
    const tenant = await accountsService.getTenantById(this.tenantId)

    if (!tenant) {
      return
    }

    const usersWithRole = await roleService.getUsersByRole(
      pendingStep.role,
      tenant
    )
    const userIds = usersWithRole.map((user) => user.id)

    if (userIds.length === 0) {
      return
    }

    return {
      ...notification,
      entityType,
      recievers: userIds,
      notificationData: {
        ...notification.notificationData,
        approval: {
          ...(notification.notificationData as any).approval,
          nextStepRole: pendingStep.role,
          isLastStep: pendingStep.isLastStep,
        },
      },
      metadata: {
        ...notification.metadata,
      },
    }
  }

  private isNotificationSubscribed(
    channel: NotificationsChannels,
    notificationType: NotificationType
  ): boolean {
    return channel.subscribedNotificationTypes().includes(notificationType)
  }

  private async validateRBAC(
    recipientId: string,
    notificationType: NotificationType
  ): Promise<boolean> {
    const CASE_OVERVIEW_READ: Resource = `read:::case-management/case-overview/*`
    const CASE_DETAILS_READ: Resource = `read:::case-management/case-details/*`
    const USER_DETAILS_READ: Resource = `read:::users/user-details/*`
    const RISK_LEVELS_READ: Resource = `read:::risk-scoring/risk-levels/*`
    const RISK_FACTORS_READ: Resource = `read:::risk-scoring/risk-factors/*`
    const notificationTypeToPermission: Record<NotificationType, Resource[]> = {
      ALERT_ASSIGNMENT: [CASE_OVERVIEW_READ],
      CASE_ASSIGNMENT: [CASE_OVERVIEW_READ],
      CASE_UNASSIGNMENT: [CASE_OVERVIEW_READ],
      ALERT_UNASSIGNMENT: [CASE_OVERVIEW_READ],
      CASE_ESCALATION: [CASE_OVERVIEW_READ],
      ALERT_ESCALATION: [CASE_OVERVIEW_READ],
      ALERT_COMMENT_MENTION: [CASE_DETAILS_READ],
      CASE_COMMENT_MENTION: [CASE_DETAILS_READ],
      USER_COMMENT_MENTION: [USER_DETAILS_READ],
      ALERT_IN_REVIEW: [CASE_OVERVIEW_READ],
      CASE_IN_REVIEW: [CASE_OVERVIEW_READ],
      ALERT_COMMENT: [CASE_DETAILS_READ],
      CASE_COMMENT: [CASE_DETAILS_READ],
      ALERT_STATUS_UPDATE: [CASE_OVERVIEW_READ],
      CASE_STATUS_UPDATE: [CASE_OVERVIEW_READ],
      RISK_CLASSIFICATION_APPROVAL: [RISK_LEVELS_READ],
      RISK_FACTORS_APPROVAL: [RISK_FACTORS_READ],
      USER_CHANGES_APPROVAL: [USER_DETAILS_READ],
    }

    const [allUsers, allRoles] = await Promise.all([
      this.getAllUsers(),
      this.getAllRoles(),
    ])

    const recipient = allUsers.find((user) => user.id === recipientId)

    if (!recipient) {
      return false
    }

    const role = allRoles.find((role) => role.name === recipient.role)

    if (!role) {
      return false
    }

    const permissionsRequired = notificationTypeToPermission[notificationType]

    if (!permissionsRequired) {
      return false
    }

    const isAllPermissions = hasResources(
      role.statements ?? [],
      permissionsRequired
    )

    return isAllPermissions
  }

  private async getFinalRecievers(
    notification: PartialNotification
  ): Promise<string[]> {
    const recievers = notification.recievers

    const validRecievers = await Promise.all(
      recievers.map(async (reciever) => {
        if (reciever === notification.triggeredBy) {
          return null
        }

        const isValid = await this.validateRBAC(
          reciever,
          notification.notificationType
        )
        return isValid ? reciever : null
      })
    )

    return compact(validRecievers)
  }

  public async handleNotification(payload: AuditLog): Promise<void> {
    const notifications = await this.getNotifications(
      payload as NotificationRawPayload
    )

    const notificationRepository = new NotificationRepository(this.tenantId, {
      mongoDb: this.mongoDb,
    })

    if (notifications.length === 0) {
      return
    }

    const notificationChannels: NotificationsChannels[] = [
      new ConsoleNotifications(this.tenantId, { mongoDb: this.mongoDb }),
    ]

    for (const notification of notifications) {
      for (const channel of notificationChannels) {
        if (
          this.isNotificationSubscribed(channel, notification.notificationType)
        ) {
          const finalRecievers = await this.getFinalRecievers(notification)

          if (finalRecievers.length === 0) {
            continue
          }

          const notificationObj: Notification = {
            ...notification,
            id: uuid(),
            notificationChannel: channel.channel,
            recievers: finalRecievers,
          }

          await notificationRepository.addNotification(notificationObj)

          await channel.send(notificationObj)
        }
      }
    }
  }
}
