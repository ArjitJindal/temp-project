import { MongoClient } from 'mongodb'
import { compact, memoize } from 'lodash'
import { v4 as uuid } from 'uuid'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { hasResources, Resource } from '@flagright/lib/utils'
import {
  RiskLevelApprovalWorkflowMachine,
  RiskFactorsApprovalWorkflowMachine,
} from '@flagright/lib/classes/workflow-machine'
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
import { RiskLevelApprovalWorkflow } from '@/@types/openapi-internal/RiskLevelApprovalWorkflow'
import { RiskFactorsApprovalWorkflow } from '@/@types/openapi-internal/RiskFactorsApprovalWorkflow'
import { WorkflowService } from '@/services/workflow'
import { RiskClassificationConfigApproval } from '@/@types/openapi-internal/RiskClassificationConfigApproval'
import { RiskFactorApproval } from '@/@types/openapi-internal/RiskFactorApproval'
import { UserApproval } from '@/@types/openapi-internal/UserApproval'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { UserUpdateApprovalWorkflow } from '@/@types/openapi-internal/UserUpdateApprovalWorkflow'

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

    for (const subscription of subscriptions) {
      if (await subscription.toSend(payload)) {
        const notification = await subscription.getNotification(payload)
        if (notification) {
          // Special handling for risk classification approval notifications
          if (
            notification.notificationType === 'RISK_CLASSIFICATION_APPROVAL'
          ) {
            const enhancedNotification =
              await this.enhanceRiskClassificationApprovalNotification(
                notification,
                payload as NotificationRawPayload<RiskClassificationConfigApproval>
              )
            if (enhancedNotification) {
              notifications.push(enhancedNotification)
            }
          } else if (
            notification.notificationType === 'RISK_FACTORS_APPROVAL'
          ) {
            const enhancedNotification =
              await this.enhanceRiskFactorsApprovalNotification(
                notification,
                payload as NotificationRawPayload<RiskFactorApproval>
              )
            if (enhancedNotification) {
              notifications.push(enhancedNotification)
            }
          } else if (
            notification.notificationType === 'USER_CHANGES_APPROVAL'
          ) {
            const enhancedNotification =
              await this.enhanceUserChangesApprovalNotification(
                notification,
                payload as NotificationRawPayload<UserApproval>
              )
            if (enhancedNotification) {
              notifications.push(enhancedNotification)
            }
          } else {
            notifications.push(notification)
          }
        }
      }
    }

    return notifications
  }

  private async enhanceRiskClassificationApprovalNotification(
    notification: PartialNotification,
    payload: NotificationRawPayload<RiskClassificationConfigApproval>
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
      'risk-levels-approval',
      approval.workflowRef.id,
      approval.workflowRef.version.toString()
    )

    const workflowMachine = new RiskLevelApprovalWorkflowMachine(
      workflow as RiskLevelApprovalWorkflow
    )

    // Get the next step in the approval chain
    const pendingStep = workflowMachine.getApprovalStep(approval.approvalStep)

    // Get users with the required role for the next step
    const roleService = RoleService.getInstance(this.dynamoDb)
    const accountsService = AccountsService.getInstance(this.dynamoDb)
    const tenant = await accountsService.getTenantById(this.tenantId)

    if (!tenant) {
      return
    }

    const usersWithRole = await roleService.getUsersByRoleName(
      pendingStep.role,
      tenant
    )
    const userIds = usersWithRole.map((user) => user.id)

    if (userIds.length === 0) {
      return
    }

    return {
      ...notification,
      entityType: 'RISK_LEVELS',
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

  // TODO: I think enhanceRiskClassificationApprovalNotification and
  //       enhanceRiskFactorsApprovalNotification can be merged into
  //       a single genericfunction.
  private async enhanceRiskFactorsApprovalNotification(
    notification: PartialNotification,
    payload: NotificationRawPayload<RiskFactorApproval>
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
      'risk-factors-approval',
      approval.workflowRef.id,
      approval.workflowRef.version.toString()
    )

    const workflowMachine = new RiskFactorsApprovalWorkflowMachine(
      workflow as RiskFactorsApprovalWorkflow
    )

    // Get the next step in the approval chain
    const pendingStep = workflowMachine.getApprovalStep(
      approval.approvalStep as number
    )

    // Get users with the required role for the next step
    const roleService = RoleService.getInstance(this.dynamoDb)
    const accountsService = AccountsService.getInstance(this.dynamoDb)
    const tenant = await accountsService.getTenantById(this.tenantId)

    if (!tenant) {
      return
    }

    const usersWithRole = await roleService.getUsersByRoleName(
      pendingStep.role,
      tenant
    )

    const userIds = usersWithRole.map((user) => user.id)

    if (userIds.length === 0) {
      return
    }

    return {
      ...notification,
      entityType: 'RISK_FACTORS',
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

  // TODO: I think enhanceRiskClassificationApprovalNotification,
  //       enhanceRiskFactorsApprovalNotification, and
  //       enhanceUserChangesApprovalNotification can be merged into
  //       a single generic function.
  private async enhanceUserChangesApprovalNotification(
    notification: PartialNotification,
    payload: NotificationRawPayload<UserApproval>
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
      'user-update-approval',
      approval.workflowRef.id,
      approval.workflowRef.version.toString()
    )

    // For user approval workflows, we need to get the field-specific workflow
    // The workflow ID is stored in the tenant settings for each field
    const accountsService = AccountsService.getInstance(this.dynamoDb)
    const tenant = await accountsService.getTenantById(this.tenantId)

    if (!tenant) {
      return
    }

    // Get tenant settings to access workflow configurations
    const tenantRepository = new TenantRepository(this.tenantId, {
      dynamoDb: this.dynamoDb,
    })
    const tenantSettings = await tenantRepository.getTenantSettings()

    // Get the field from the proposed changes
    const field = approval.proposedChanges[0]?.field
    if (!field) {
      return
    }

    // Get the workflow ID directly from tenant settings
    // The field names in userApprovalWorkflows match the field names in proposedChanges
    const workflowId =
      tenantSettings?.workflowSettings?.userApprovalWorkflows?.[field]
    console.log(
      `User approval notification: field=${field}, workflowId=${workflowId}, tenantSettings.workflowSettings=${JSON.stringify(
        tenantSettings?.workflowSettings
      )}`
    )

    if (!workflowId) {
      console.log(
        `User approval notification: No workflow found for field ${field}. Notification will not be sent.`
      )
      return
    }

    const fieldWorkflow = await workflowService.getWorkflowVersion(
      'user-update-approval',
      workflowId,
      workflow.version.toString()
    )

    // Cast to UserUpdateApprovalWorkflow to access approvalChain
    const userUpdateWorkflow = fieldWorkflow as UserUpdateApprovalWorkflow // Type assertion needed since Workflow is generic

    // Get the current step in the approval process
    const currentStep = approval.approvalStep
    const approvalChain = userUpdateWorkflow.approvalChain

    // Check if we're at a valid step
    if (currentStep >= approvalChain.length) {
      console.log(
        `User approval notification: Approval step ${currentStep} is beyond the approval chain length ${approvalChain.length}`
      )
      return
    }

    // Get the role required for the current step
    const currentStepRole = approvalChain[currentStep]
    const isLastStep = currentStep === approvalChain.length - 1

    // Get users with the required role for the current step
    const roleService = RoleService.getInstance(this.dynamoDb)
    const usersWithRole = await roleService.getUsersByRoleName(
      currentStepRole,
      tenant
    )
    const userIds = usersWithRole.map((user) => user.id)

    if (userIds.length === 0) {
      console.log(
        `User approval notification: No users found with role ${currentStepRole} for step ${currentStep}`
      )
      return
    }

    console.log(
      `User approval notification: Sending notification to users with role ${currentStepRole} for step ${currentStep} (isLastStep: ${isLastStep})`
    )

    return {
      ...notification,
      entityType: 'USER',
      recievers: userIds,
      notificationData: {
        ...notification.notificationData,
        approval: {
          ...(notification.notificationData as any).approval,
          nextStepRole: currentStepRole,
          isLastStep: isLastStep,
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
