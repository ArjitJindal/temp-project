import isEmpty from 'lodash/isEmpty'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { Case } from '@/@types/openapi-internal/Case'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-internal/Business'
import { ListItem } from '@/@types/openapi-internal/ListItem'
import { UserService } from '@/services/users'
import { ListService } from '@/services/list'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { UserProposedChange } from '@/@types/openapi-internal/UserProposedChange'
import { TenantSettings } from '@/@types/openapi-internal/TenantSettings'
import { WorkflowSettingsUserApprovalWorkflows } from '@/@types/openapi-internal/WorkflowSettingsUserApprovalWorkflows'
import { CaseStatusUpdate } from '@/@types/openapi-internal/CaseStatusUpdate'
import { AlertStatusUpdateRequest } from '@/@types/openapi-internal/AlertStatusUpdateRequest'
import { tenantSettings, hasFeature } from '@/core/utils/context'
import { getContext } from '@/core/utils/context-storage'
import { PEPStatus } from '@/@types/openapi-internal/PEPStatus'

export interface UserData {
  caseId: string
  user: User | Business
}

export interface UpdateUserDetailsOptions {
  tenantId: string
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
  cases: Case[]
  updates: CaseStatusUpdate | AlertStatusUpdateRequest
  getUserUpdateRequest: (
    updates: CaseStatusUpdate | AlertStatusUpdateRequest,
    userInDb?: InternalUser
  ) => UserUpdateRequest
}

interface PepProposalValue {
  pepStatus?: Array<PEPStatus>
  sanctionsStatus?: boolean
  adverseMediaStatus?: boolean
}

/**
 * Maps UserUpdateRequest fields to WorkflowSettingsUserApprovalWorkflows field names
 */
const FIELD_MAPPING: Record<
  string,
  keyof WorkflowSettingsUserApprovalWorkflows
> = {
  eoddDate: 'eoddDate',
  pepStatus: 'PepStatus',
  adverseMediaStatus: 'PepStatus', // PEP status includes adverse media
  sanctionsStatus: 'PepStatus', // PEP status includes sanctions
  // CRA fields would need to be added when CRA is supported in dispositions
}

/**
 * Common utility function to update user details and list items with approval workflow support
 * Used by both alerts and cases services to avoid code duplication
 */
export async function updateUserDetails({
  tenantId,
  mongoDb,
  dynamoDb,
  cases,
  updates,
  getUserUpdateRequest,
}: UpdateUserDetailsOptions): Promise<void> {
  // Extract users from cases
  const usersData = extractUsersFromCases(cases)
  if (isEmpty(usersData)) {
    return
  }

  // Initialize services
  const userService = new UserService(tenantId, { mongoDb, dynamoDb })
  const listService = new ListService(tenantId, { mongoDb, dynamoDb })

  // Get user update object
  const userInDb = await userService.getUser(usersData[0].user.userId, false)
  const updateObject: UserUpdateRequest = getUserUpdateRequest(
    updates,
    userInDb
  )

  // Handle user updates based on approval feature
  if (!isEmpty(updateObject)) {
    if (hasFeature('USER_CHANGES_APPROVAL')) {
      await processWithApprovalWorkflow(
        usersData,
        updateObject,
        userService,
        updates
      )
    } else {
      await processDirectUpdates(usersData, updateObject, userService)
    }
  }

  // Handle list updates
  await handleListUpdates(usersData, updates.listId, listService)
}

/**
 * Extract users from cases
 */
function extractUsersFromCases(cases: Case[]): UserData[] {
  const usersData: UserData[] = []

  cases.forEach((c) => {
    const user = c?.caseUsers?.origin ?? c?.caseUsers?.destination
    if (user && user.userId) {
      usersData.push({
        caseId: c.caseId ?? '',
        user: user as User | Business,
      })
    }
  })

  return usersData
}

/**
 * Process updates with approval workflow (when USER_CHANGES_APPROVAL is enabled)
 */
async function processWithApprovalWorkflow(
  usersData: UserData[],
  updateObject: UserUpdateRequest,
  userService: UserService,
  updates: CaseStatusUpdate | AlertStatusUpdateRequest
): Promise<void> {
  // Get tenant settings to check approval workflows
  const settings: TenantSettings = await tenantSettings(userService.tenantId)
  const workflowSettings = settings.workflowSettings?.userApprovalWorkflows

  // Separate fields that need approval from those that don't
  const { approvalFields, directFields } = categorizeFields(
    updateObject,
    workflowSettings
  )

  // Apply direct fields immediately
  if (!isEmpty(directFields)) {
    await processDirectUpdates(usersData, directFields, userService)
  }

  // Create approval proposals for fields that need approval
  if (!isEmpty(approvalFields)) {
    await createApprovalProposals(
      usersData,
      approvalFields,
      userService,
      updates
    )
  }
}

/**
 * Process direct updates (no approval needed)
 */
async function processDirectUpdates(
  usersData: UserData[],
  updateObject: UserUpdateRequest,
  userService: UserService
): Promise<void> {
  await Promise.all(
    usersData.map(({ user, caseId }) =>
      userService.updateUser(user, updateObject, {}, { caseId })
    )
  )
}

/**
 * Categorize fields into those needing approval vs direct application
 */
function categorizeFields(
  updateObject: UserUpdateRequest,
  workflowSettings?: WorkflowSettingsUserApprovalWorkflows
): {
  approvalFields: UserUpdateRequest
  directFields: UserUpdateRequest
} {
  const approvalFields: UserUpdateRequest = {}
  const directFields: UserUpdateRequest = {}

  for (const [fieldName, value] of Object.entries(updateObject)) {
    if (value === undefined) {
      continue
    }

    const workflowField = FIELD_MAPPING[fieldName]
    const hasWorkflow = workflowField && workflowSettings?.[workflowField]

    if (hasWorkflow) {
      // Field needs approval
      approvalFields[fieldName] = value
    } else {
      // Field can be applied directly
      directFields[fieldName] = value
    }
  }

  return { approvalFields, directFields }
}

/**
 * Create approval proposals for fields that need approval
 */
async function createApprovalProposals(
  usersData: UserData[],
  approvalFields: UserUpdateRequest,
  userService: UserService,
  updates: CaseStatusUpdate | AlertStatusUpdateRequest
): Promise<void> {
  const context = getContext()
  const userId = context?.user?.id

  if (!userId) {
    throw new Error('User context not found for creating approval proposals')
  }

  // Create comment explaining the disposition context
  const comment = createApprovalComment(updates, approvalFields)

  // Create approval proposals for each user
  for (const { user } of usersData) {
    // Handle each field that needs approval
    for (const [fieldName, value] of Object.entries(approvalFields)) {
      if (value === undefined) {
        continue
      }

      // For PEP status fields, we need to handle the complex structure
      if (
        fieldName === 'pepStatus' ||
        fieldName === 'adverseMediaStatus' ||
        fieldName === 'sanctionsStatus'
      ) {
        // Group PEP-related fields into a single proposal
        const pepStatusValue: PepProposalValue = {}

        if (approvalFields.pepStatus !== undefined) {
          pepStatusValue.pepStatus = approvalFields.pepStatus
        }
        if (approvalFields.adverseMediaStatus !== undefined) {
          pepStatusValue.adverseMediaStatus = approvalFields.adverseMediaStatus
        }
        if (approvalFields.sanctionsStatus !== undefined) {
          pepStatusValue.sanctionsStatus = approvalFields.sanctionsStatus
        }

        // Only create one proposal for all PEP-related fields
        if (fieldName === 'pepStatus') {
          const proposedChange: UserProposedChange = {
            field: 'PepStatus',
            value: pepStatusValue,
          }

          await userService.proposeUserFieldChange(
            user.userId,
            proposedChange,
            comment,
            userId
          )
        }
        // Skip other PEP fields as they're included in the PepStatus proposal
        continue
      }

      // Handle other individual fields
      const workflowField = FIELD_MAPPING[fieldName]
      if (workflowField) {
        const proposedChange: UserProposedChange = {
          field: workflowField,
          value,
        }

        await userService.proposeUserFieldChange(
          user.userId,
          proposedChange,
          comment,
          userId
        )
      }
    }
  }
}

/**
 * Create comment explaining the approval request context
 */
function createApprovalComment(
  updates: CaseStatusUpdate | AlertStatusUpdateRequest,
  _approvalFields: UserUpdateRequest
): string {
  const entityType = 'alertStatus' in updates ? 'alert' : 'case'
  const userReason = updates.otherReason?.trim() || ''

  // If no user reason provided, use a generic message
  const reasonText = userReason || 'User field changes requested'

  return `${reasonText}\nChange requested via ${entityType} close disposition`
}

/**
 * Handle list item updates
 */
async function handleListUpdates(
  usersData: UserData[],
  listId: string | undefined,
  listService: ListService
): Promise<void> {
  if (!listId) {
    return
  }

  await Promise.all(
    usersData.map(({ user }) => {
      const userFullName = extractUserFullName(user)
      const listItem: ListItem = {
        key: user.userId,
        metadata: {
          reason: '',
          userFullName,
        },
      }
      return listService.updateOrCreateListItem(listId, listItem)
    })
  )
}

/**
 * Extracts the full name from a user or business entity
 */
export function extractUserFullName(user: User | Business): string {
  // Handle individual user with userDetails
  if ('userDetails' in user && user.userDetails?.name) {
    const {
      firstName = '',
      middleName = '',
      lastName = '',
    } = user.userDetails.name
    return [lastName, firstName, middleName].filter(Boolean).join(' ') || ''
  }

  // Handle business entity
  if ('legalEntity' in user && Array.isArray(user.legalEntity)) {
    return user.legalEntity?.companyGeneralDetails?.legalName || ''
  }

  return ''
}
